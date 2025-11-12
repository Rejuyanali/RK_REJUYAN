import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bull';
import { UploadController } from './upload.controller';
import { UploadService } from './upload.service';
import { S3Module } from '../s3/s3.module';

@Module({
  imports: [
    S3Module,
    BullModule.registerQueue({
      name: 'file-processing',
    }),
  ],
  controllers: [UploadController],
  providers: [UploadService],
  exports: [UploadService],
})
export class UploadModule {}
