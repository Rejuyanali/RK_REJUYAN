import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerModule } from '@nestjs/throttler';
import { BullModule } from '@nestjs/bull';
import { AuthModule } from './auth/auth.module';
import { UserModule } from './user/user.module';
import { FileModule } from './file/file.module';
import { UploadModule } from './upload/upload.module';
import { DownloadModule } from './download/download.module';
import { PaymentModule } from './payment/payment.module';
import { TelegramModule } from './telegram/telegram.module';
import { AdminModule } from './admin/admin.module';
import { PrismaModule } from './common/prisma/prisma.module';
import { S3Module } from './common/s3/s3.module';
import { AppController } from './app.controller';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    ThrottlerModule.forRoot([
      {
        ttl: 60000, // 1 minute
        limit: 100, // 100 requests per minute
      },
    ]),
    BullModule.forRoot({
      redis: {
        host: process.env.REDIS_HOST || 'localhost',
        port: parseInt(process.env.REDIS_PORT || '6379'),
        password: process.env.REDIS_PASSWORD,
      },
    }),
    PrismaModule,
    S3Module,
    AuthModule,
    UserModule,
    FileModule,
    UploadModule,
    DownloadModule,
    PaymentModule,
    TelegramModule,
    AdminModule,
  ],
  controllers: [AppController],
})
export class AppModule {}
