import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bull';
import { UploadController } from './upload.controller';
import { UploadService } from './upload.service';
import { UploadProcessor } from './upload.processor';

@Module({
  imports: [
    BullModule.registerQueue({
      name: 'upload',
    }),
  ],
  controllers: [UploadController],
  providers: [UploadService, UploadProcessor],
  exports: [UploadService],
})
export class UploadModule {}
