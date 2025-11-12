import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class UserService {
  constructor(
    private prisma: PrismaService,
    private configService: ConfigService,
  ) {}

  async getUserStats(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        totalUploads: true,
        totalDownloads: true,
        totalEarnings: true,
        premiumUntil: true,
      },
    });

    const isPremium = user?.premiumUntil ? new Date(user.premiumUntil) > new Date() : false;

    // Get file stats
    const fileStats = await this.prisma.file.aggregate({
      where: { userId },
      _sum: {
        downloadsCount: true,
        viewsCount: true,
      },
      _count: true,
    });

    // Get pending payout amount
    const pendingPayouts = await this.prisma.payout.aggregate({
      where: {
        userId,
        status: 'PENDING',
      },
      _sum: {
        amountCents: true,
      },
    });

    const minPayoutThreshold = parseInt(
      this.configService.get('MIN_PAYOUT_THRESHOLD_CENTS') || '5000',
    );

    const availableForPayout = user.totalEarnings - (pendingPayouts._sum.amountCents || 0);
    const canRequestPayout = availableForPayout >= minPayoutThreshold;

    return {
      totalUploads: user.totalUploads,
      totalDownloads: fileStats._sum.downloadsCount || 0,
      totalViews: fileStats._sum.viewsCount || 0,
      totalFiles: fileStats._count,
      totalEarningsCents: user.totalEarnings,
      pendingPayoutsCents: pendingPayouts._sum.amountCents || 0,
      availableForPayoutCents: availableForPayout,
      canRequestPayout,
      minPayoutThresholdCents: minPayoutThreshold,
      isPremium,
      premiumUntil: user.premiumUntil,
    };
  }

  async requestPayout(userId: string, paymentMethod: string, paymentEmail: string) {
    const stats = await this.getUserStats(userId);

    if (!stats.canRequestPayout) {
      throw new Error(
        `Minimum payout threshold not met. Need ${stats.minPayoutThresholdCents} cents, have ${stats.availableForPayoutCents} cents`,
      );
    }

    const payout = await this.prisma.payout.create({
      data: {
        userId,
        amountCents: stats.availableForPayoutCents,
        paymentMethod,
        paymentEmail,
        status: 'PENDING',
      },
    });

    return payout;
  }

  async getPayoutHistory(userId: string) {
    const payouts = await this.prisma.payout.findMany({
      where: { userId },
      orderBy: { requestedAt: 'desc' },
    });

    return payouts;
  }
}
