import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
  HeadObjectCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

export interface PresignedUploadUrl {
  uploadUrl: string;
  key: string;
  bucket: string;
  expiresIn: number;
}

export interface PresignedDownloadUrl {
  downloadUrl: string;
  expiresIn: number;
}

@Injectable()
export class S3Service {
  private readonly logger = new Logger(S3Service.name);
  private readonly s3Client: S3Client;
  private readonly bucket: string;

  constructor(private configService: ConfigService) {
    const endpoint = this.configService.get<string>('S3_ENDPOINT');
    const region = this.configService.get<string>('S3_REGION', 'us-east-1');
    const accessKeyId = this.configService.get<string>('S3_ACCESS_KEY_ID');
    const secretAccessKey = this.configService.get<string>('S3_SECRET_ACCESS_KEY');

    this.bucket = this.configService.get<string>('S3_BUCKET', 'filehost');

    this.s3Client = new S3Client({
      endpoint,
      region,
      credentials: {
        accessKeyId,
        secretAccessKey,
      },
      forcePathStyle: !!endpoint, // Required for MinIO
    });

    this.logger.log(`S3 service initialized with bucket: ${this.bucket}`);
  }

  async generatePresignedUploadUrl(
    key: string,
    contentType: string,
    expiresIn = 3600,
  ): Promise<PresignedUploadUrl> {
    const command = new PutObjectCommand({
      Bucket: this.bucket,
      Key: key,
      ContentType: contentType,
    });

    const uploadUrl = await getSignedUrl(this.s3Client, command, { expiresIn });

    return {
      uploadUrl,
      key,
      bucket: this.bucket,
      expiresIn,
    };
  }

  async generatePresignedDownloadUrl(
    key: string,
    expiresIn = 3600,
    filename?: string,
  ): Promise<PresignedDownloadUrl> {
    const command = new GetObjectCommand({
      Bucket: this.bucket,
      Key: key,
      ResponseContentDisposition: filename
        ? `attachment; filename="${filename}"`
        : undefined,
    });

    const downloadUrl = await getSignedUrl(this.s3Client, command, { expiresIn });

    return {
      downloadUrl,
      expiresIn,
    };
  }

  async deleteObject(key: string): Promise<void> {
    const command = new DeleteObjectCommand({
      Bucket: this.bucket,
      Key: key,
    });

    await this.s3Client.send(command);
    this.logger.log(`Deleted object: ${key}`);
  }

  async objectExists(key: string): Promise<boolean> {
    try {
      const command = new HeadObjectCommand({
        Bucket: this.bucket,
        Key: key,
      });
      await this.s3Client.send(command);
      return true;
    } catch (error) {
      return false;
    }
  }

  async getObjectMetadata(key: string) {
    const command = new HeadObjectCommand({
      Bucket: this.bucket,
      Key: key,
    });

    return await this.s3Client.send(command);
  }
}
