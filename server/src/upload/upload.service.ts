import { Injectable, BadRequestException, ForbiddenException } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';
import { PrismaService } from '../prisma/prisma.service';
import { S3Service } from '../s3/s3.service';
import { ConfigService } from '@nestjs/config';
import { nanoid } from 'nanoid';
import * as mime from 'mime-types';

@Injectable()
export class UploadService {
  constructor(
    private prisma: PrismaService,
    private s3Service: S3Service,
    private configService: ConfigService,
    @InjectQueue('file-processing') private fileQueue: Queue,
  ) {}

  async initiateUpload(
    fileName: string,
    fileSize: number,
    mimeType: string,
    userId?: string,
  ) {
    // Validate file size
    const user = userId ? await this.prisma.user.findUnique({ where: { id: userId } }) : null;
    const isPremium = user?.premiumUntil ? new Date(user.premiumUntil) > new Date() : false;

    const maxSize = isPremium
      ? parseInt(this.configService.get('MAX_FILE_SIZE_PREMIUM'))
      : parseInt(this.configService.get('MAX_FILE_SIZE_FREE'));

    if (fileSize > maxSize) {
      throw new BadRequestException(
        `File size exceeds limit. Max: ${this.formatBytes(maxSize)}`,
      );
    }

    // Validate MIME type
    const allowedTypes = this.configService.get('ALLOWED_MIME_TYPES')?.split(',') || [];
    const isAllowed = allowedTypes.some((pattern) => {
      if (pattern.endsWith('/*')) {
        return mimeType.startsWith(pattern.replace('/*', ''));
      }
      return mimeType === pattern;
    });

    if (!isAllowed && allowedTypes.length > 0) {
      throw new BadRequestException('File type not allowed');
    }

    // Generate unique IDs
    const publicId = nanoid(10);
    const s3Key = `uploads/${publicId}/${fileName}`;

    // Create file record
    const file = await this.prisma.file.create({
      data: {
        publicId,
        userId,
        originalName: fileName,
        s3Key,
        size: BigInt(fileSize),
        mimeType,
        visibility: 'PUBLIC',
      },
    });

    // Generate presigned upload URL
    const uploadUrl = await this.s3Service.getPresignedUploadUrl(s3Key, mimeType, 3600);

    // Queue thumbnail generation if image
    if (mimeType.startsWith('image/')) {
      await this.fileQueue.add('generate-thumbnail', {
        fileId: file.id,
        s3Key,
        mimeType,
      });
    }

    // Queue virus scan
    if (this.configService.get('ENABLE_VIRUS_SCAN') === 'true') {
      await this.fileQueue.add('virus-scan', {
        fileId: file.id,
        s3Key,
      });
    }

    // Update user stats
    if (userId) {
      await this.prisma.user.update({
        where: { id: userId },
        data: { totalUploads: { increment: 1 } },
      });
    }

    return {
      fileId: file.id,
      publicId: file.publicId,
      uploadUrl,
      expiresIn: 3600,
    };
  }

  async uploadFromRemoteUrl(url: string, userId?: string) {
    // Validate URL
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      throw new BadRequestException('Invalid URL');
    }

    // Queue remote fetch job
    const job = await this.fileQueue.add('remote-fetch', {
      url,
      userId,
    });

    return {
      jobId: job.id,
      status: 'processing',
      message: 'File is being fetched from remote URL',
    };
  }

  async getUploadStatus(jobId: string) {
    const job = await this.fileQueue.getJob(jobId);

    if (!job) {
      throw new BadRequestException('Job not found');
    }

    const state = await job.getState();
    const progress = job.progress();

    return {
      jobId: job.id,
      status: state,
      progress,
      result: state === 'completed' ? job.returnvalue : null,
    };
  }

  private formatBytes(bytes: number): string {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
  }
}
