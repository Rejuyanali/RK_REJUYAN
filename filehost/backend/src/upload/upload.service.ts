import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';
import { PrismaService } from '../common/prisma/prisma.service';
import { S3Service } from '../common/s3/s3.service';
import { ConfigService } from '@nestjs/config';
import { nanoid } from 'nanoid';
import { InitiateUploadDto } from './dto/initiate-upload.dto';
import { RemoteUploadDto } from './dto/remote-upload.dto';
import { User, FileVisibility } from '@prisma/client';
import * as mimeTypes from 'mime-types';

@Injectable()
export class UploadService {
  private readonly logger = new Logger(UploadService.name);

  constructor(
    private prisma: PrismaService,
    private s3Service: S3Service,
    private configService: ConfigService,
    @InjectQueue('upload') private uploadQueue: Queue,
  ) {}

  async initiateUpload(dto: InitiateUploadDto, user?: User) {
    // Check file size limits
    const maxSizeKey = user?.premiumUntil && new Date(user.premiumUntil) > new Date()
      ? 'max_file_size_premium'
      : 'max_file_size_free';

    const maxSizeSetting = await this.prisma.setting.findUnique({
      where: { key: maxSizeKey },
    });
    const maxSize = maxSizeSetting ? parseInt(maxSizeSetting.value) : 104857600; // 100MB default

    // Validate MIME type
    await this.validateMimeType(dto.contentType);

    // Generate unique file ID and S3 key
    const publicId = nanoid(10);
    const s3Key = `uploads/${publicId}/${dto.filename}`;

    // Generate presigned upload URL
    const presignedUrl = await this.s3Service.generatePresignedUploadUrl(
      s3Key,
      dto.contentType,
      3600, // 1 hour expiry
    );

    // Create file record
    const file = await this.prisma.file.create({
      data: {
        publicId,
        originalName: dto.filename,
        s3Key,
        s3Bucket: presignedUrl.bucket,
        size: 0, // Will be updated after upload
        mimeType: dto.contentType,
        description: dto.description,
        visibility: (dto.visibility as FileVisibility) || FileVisibility.PUBLIC,
        userId: user?.id,
        expiresAt: this.calculateExpiryDate(),
      },
    });

    return {
      fileId: file.id,
      publicId: file.publicId,
      uploadUrl: presignedUrl.uploadUrl,
      maxSize,
      expiresIn: presignedUrl.expiresIn,
    };
  }

  async completeUpload(fileId: string) {
    const file = await this.prisma.file.findUnique({ where: { id: fileId } });
    if (!file) {
      throw new BadRequestException('File not found');
    }

    // Get actual file size from S3
    try {
      const metadata = await this.s3Service.getObjectMetadata(file.s3Key);
      const size = metadata.ContentLength || 0;

      // Update file with actual size
      await this.prisma.file.update({
        where: { id: fileId },
        data: { size: BigInt(size), isProcessed: true },
      });

      // Queue for thumbnail generation if image
      if (file.mimeType.startsWith('image/')) {
        await this.uploadQueue.add('generate-thumbnail', { fileId });
      }

      // Update user stats
      if (file.userId) {
        await this.prisma.user.update({
          where: { id: file.userId },
          data: { totalUploads: { increment: 1 } },
        });
      }

      return { success: true, publicId: file.publicId };
    } catch (error) {
      this.logger.error(`Error completing upload for file ${fileId}:`, error);
      throw new BadRequestException('Failed to complete upload');
    }
  }

  async initiateRemoteUpload(dto: RemoteUploadDto, user?: User) {
    // Validate URL
    if (!dto.url.startsWith('http://') && !dto.url.startsWith('https://')) {
      throw new BadRequestException('Invalid URL');
    }

    // Generate unique file ID
    const publicId = nanoid(10);

    // Queue the remote fetch job
    const job = await this.uploadQueue.add('remote-fetch', {
      publicId,
      url: dto.url,
      userId: user?.id,
      description: dto.description,
      visibility: dto.visibility || 'PUBLIC',
    });

    return {
      publicId,
      jobId: job.id,
      status: 'processing',
      message: 'Remote file fetch initiated',
    };
  }

  private async validateMimeType(mimeType: string) {
    const setting = await this.prisma.setting.findUnique({
      where: { key: 'allowed_mime_types' },
    });

    if (!setting) {
      return; // No restrictions if not configured
    }

    const allowedPatterns = setting.value.split(',').map((p) => p.trim());
    const isAllowed = allowedPatterns.some((pattern) => {
      if (pattern.endsWith('/*')) {
        const prefix = pattern.slice(0, -2);
        return mimeType.startsWith(prefix);
      }
      return mimeType === pattern;
    });

    if (!isAllowed) {
      throw new BadRequestException(
        `File type ${mimeType} is not allowed. Allowed types: ${setting.value}`,
      );
    }
  }

  private calculateExpiryDate(): Date | null {
    const setting = this.configService.get<string>('FILE_EXPIRY_DAYS');
    if (!setting) return null;

    const days = parseInt(setting);
    if (isNaN(days) || days <= 0) return null;

    const expiryDate = new Date();
    expiryDate.setDate(expiryDate.getDate() + days);
    return expiryDate;
  }
}
