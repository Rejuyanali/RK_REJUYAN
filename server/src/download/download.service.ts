import { Injectable, NotFoundException, ForbiddenException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { S3Service } from '../s3/s3.service';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class DownloadService {
  constructor(
    private prisma: PrismaService,
    private s3Service: S3Service,
    private configService: ConfigService,
  ) {}

  async getDownloadInfo(publicId: string, userId?: string) {
    const file = await this.prisma.file.findUnique({
      where: { publicId },
      include: {
        user: {
          select: {
            id: true,
            username: true,
            premiumUntil: true,
          },
        },
      },
    });

    if (!file) {
      throw new NotFoundException('File not found');
    }

    if (file.takenDown) {
      throw new ForbiddenException('File has been taken down');
    }

    if (file.expiresAt && new Date(file.expiresAt) < new Date()) {
      throw new NotFoundException('File has expired');
    }

    // Check if user is premium
    const currentUser = userId
      ? await this.prisma.user.findUnique({ where: { id: userId } })
      : null;
    const isPremium = currentUser?.premiumUntil
      ? new Date(currentUser.premiumUntil) > new Date()
      : false;

    // Check if file owner is premium (affects download experience)
    const isOwnerPremium = file.user?.premiumUntil
      ? new Date(file.user.premiumUntil) > new Date()
      : false;

    const waitSeconds = isPremium || isOwnerPremium
      ? 0
      : parseInt(this.configService.get('FREE_USER_WAIT_SECONDS') || '9');

    return {
      fileId: file.id,
      publicId: file.publicId,
      fileName: file.originalName,
      fileSize: file.size.toString(),
      mimeType: file.mimeType,
      waitSeconds,
      requiresWait: waitSeconds > 0,
      isPremium: isPremium || isOwnerPremium,
    };
  }

  async generateDownloadLink(
    publicId: string,
    ip: string,
    userAgent: string,
    userId?: string,
  ) {
    const file = await this.prisma.file.findUnique({
      where: { publicId },
      include: {
        user: true,
      },
    });

    if (!file) {
      throw new NotFoundException('File not found');
    }

    if (file.takenDown) {
      throw new ForbiddenException('File has been taken down');
    }

    // Check rate limiting per IP
    const recentDownloads = await this.prisma.download.count({
      where: {
        ip,
        createdAt: {
          gte: new Date(Date.now() - 15 * 60 * 1000), // Last 15 minutes
        },
      },
    });

    const maxDownloadsPerIp = parseInt(
      this.configService.get('DOWNLOAD_RATE_LIMIT_PER_IP') || '10',
    );

    if (recentDownloads >= maxDownloadsPerIp) {
      throw new BadRequestException('Download rate limit exceeded. Please try again later.');
    }

    // Create download record
    const download = await this.prisma.download.create({
      data: {
        fileId: file.id,
        ip,
        userAgent,
      },
    });

    // Increment download count
    await this.prisma.file.update({
      where: { id: file.id },
      data: { downloadsCount: { increment: 1 } },
    });

    // Update user stats
    if (file.userId) {
      await this.prisma.user.update({
        where: { id: file.userId },
        data: { totalDownloads: { increment: 1 } },
      });
    }

    // Generate presigned download URL
    const downloadUrl = await this.s3Service.getPresignedDownloadUrl(file.s3Key, 3600);

    return {
      downloadUrl,
      expiresIn: 3600,
      downloadId: download.id,
    };
  }

  async trackDownloadCompletion(downloadId: string, bytesServed: number) {
    const download = await this.prisma.download.findUnique({
      where: { id: downloadId },
      include: {
        file: {
          include: {
            user: true,
          },
        },
      },
    });

    if (!download) {
      throw new NotFoundException('Download record not found');
    }

    const completionThreshold = parseFloat(
      this.configService.get('DOWNLOAD_COMPLETION_THRESHOLD') || '0.8',
    );
    const fileSize = Number(download.file.size);
    const isCompleted = bytesServed >= fileSize * completionThreshold;

    // Calculate earnings
    let earningsCents = 0;
    if (isCompleted && download.file.userId) {
      earningsCents = parseInt(
        this.configService.get('EARNINGS_PER_DOWNLOAD_CENTS') || '10',
      );

      // Update user earnings
      await this.prisma.user.update({
        where: { id: download.file.userId },
        data: {
          totalEarnings: { increment: earningsCents },
        },
      });
    }

    // Update download record
    await this.prisma.download.update({
      where: { id: downloadId },
      data: {
        bytesServed: BigInt(bytesServed),
        completed: isCompleted,
        paid: isCompleted,
        earningsCents,
      },
    });

    return {
      completed: isCompleted,
      earningsCents,
    };
  }
}
