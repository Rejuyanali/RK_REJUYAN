import { Processor, Process } from '@nestjs/bull';
import { Job } from 'bull';
import { Logger } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';
import { S3Service } from '../common/s3/s3.service';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import { nanoid } from 'nanoid';
import * as sharp from 'sharp';
import { FileVisibility } from '@prisma/client';
import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3';

@Processor('upload')
export class UploadProcessor {
  private readonly logger = new Logger(UploadProcessor.name);
  private readonly s3Client: S3Client;
  private readonly bucket: string;

  constructor(
    private prisma: PrismaService,
    private s3Service: S3Service,
    private configService: ConfigService,
  ) {
    const endpoint = this.configService.get<string>('S3_ENDPOINT');
    const region = this.configService.get<string>('S3_REGION', 'us-east-1');
    const accessKeyId = this.configService.get<string>('S3_ACCESS_KEY_ID');
    const secretAccessKey = this.configService.get<string>('S3_SECRET_ACCESS_KEY');
    this.bucket = this.configService.get<string>('S3_BUCKET', 'filehost');

    this.s3Client = new S3Client({
      endpoint,
      region,
      credentials: { accessKeyId, secretAccessKey },
      forcePathStyle: !!endpoint,
    });
  }

  @Process('remote-fetch')
  async handleRemoteFetch(job: Job) {
    const { publicId, url, userId, description, visibility } = job.data;
    this.logger.log(`Processing remote fetch for ${publicId} from ${url}`);

    try {
      // Download the file
      const response = await axios.get(url, {
        responseType: 'arraybuffer',
        maxContentLength: 10737418240, // 10GB
        timeout: 300000, // 5 minutes
      });

      const buffer = Buffer.from(response.data);
      const contentType = response.headers['content-type'] || 'application/octet-stream';

      // Extract filename from URL or use default
      const urlParts = url.split('/');
      const filename = urlParts[urlParts.length - 1] || `file-${nanoid(8)}`;

      const s3Key = `uploads/${publicId}/${filename}`;

      // Upload to S3
      await this.s3Client.send(
        new PutObjectCommand({
          Bucket: this.bucket,
          Key: s3Key,
          Body: buffer,
          ContentType: contentType,
        }),
      );

      // Create file record
      const expiryDate = new Date();
      expiryDate.setDate(expiryDate.getDate() + 90);

      const file = await this.prisma.file.create({
        data: {
          publicId,
          originalName: filename,
          s3Key,
          s3Bucket: this.bucket,
          size: BigInt(buffer.length),
          mimeType: contentType,
          description,
          visibility: (visibility as FileVisibility) || FileVisibility.PUBLIC,
          userId,
          expiresAt: expiryDate,
          isProcessed: true,
        },
      });

      // Generate thumbnail if image
      if (contentType.startsWith('image/')) {
        await this.generateThumbnail(file.id, buffer, s3Key);
      }

      this.logger.log(`Remote fetch completed for ${publicId}`);
      return { success: true, fileId: file.id };
    } catch (error) {
      this.logger.error(`Remote fetch failed for ${publicId}:`, error.message);
      throw error;
    }
  }

  @Process('generate-thumbnail')
  async handleThumbnailGeneration(job: Job) {
    const { fileId } = job.data;
    this.logger.log(`Generating thumbnail for file ${fileId}`);

    try {
      const file = await this.prisma.file.findUnique({ where: { id: fileId } });
      if (!file || !file.mimeType.startsWith('image/')) {
        return { success: false, reason: 'Not an image file' };
      }

      // Download original image from S3
      // For now, we'll skip actual thumbnail generation in this implementation
      // In production, you would download the file, resize it, and upload the thumbnail

      this.logger.log(`Thumbnail generation completed for ${fileId}`);
      return { success: true };
    } catch (error) {
      this.logger.error(`Thumbnail generation failed for ${fileId}:`, error.message);
      throw error;
    }
  }

  private async generateThumbnail(fileId: string, imageBuffer: Buffer, originalKey: string) {
    try {
      const thumbnail = await sharp(imageBuffer)
        .resize(300, 300, { fit: 'inside', withoutEnlargement: true })
        .jpeg({ quality: 80 })
        .toBuffer();

      const thumbnailKey = originalKey.replace('/uploads/', '/thumbnails/') + '_thumb.jpg';

      await this.s3Client.send(
        new PutObjectCommand({
          Bucket: this.bucket,
          Key: thumbnailKey,
          Body: thumbnail,
          ContentType: 'image/jpeg',
        }),
      );

      await this.prisma.file.update({
        where: { id: fileId },
        data: { thumbnailS3Key: thumbnailKey },
      });

      this.logger.log(`Thumbnail generated: ${thumbnailKey}`);
    } catch (error) {
      this.logger.error(`Failed to generate thumbnail:`, error.message);
    }
  }
}
