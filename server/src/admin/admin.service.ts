import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { S3Service } from '../s3/s3.service';

@Injectable()
export class AdminService {
  constructor(
    private prisma: PrismaService,
    private s3Service: S3Service,
  ) {}

  async getDashboardStats() {
    const [
      totalUsers,
      totalFiles,
      totalDownloads,
      pendingReports,
      pendingPayouts,
      recentUploads,
    ] = await Promise.all([
      this.prisma.user.count(),
      this.prisma.file.count(),
      this.prisma.download.count(),
      this.prisma.report.count({ where: { reviewed: false } }),
      this.prisma.payout.count({ where: { status: 'PENDING' } }),
      this.prisma.file.count({
        where: {
          createdAt: {
            gte: new Date(Date.now() - 24 * 60 * 60 * 1000),
          },
        },
      }),
    ]);

    const totalStorage = await this.prisma.file.aggregate({
      _sum: {
        size: true,
      },
    });

    return {
      totalUsers,
      totalFiles,
      totalDownloads,
      pendingReports,
      pendingPayouts,
      recentUploads,
      totalStorageBytes: totalStorage._sum.size?.toString() || '0',
    };
  }

  async getUsers(page = 1, limit = 20, search?: string) {
    const skip = (page - 1) * limit;
    const where = search
      ? {
          OR: [
            { email: { contains: search, mode: 'insensitive' as any } },
            { username: { contains: search, mode: 'insensitive' as any } },
          ],
        }
      : {};

    const [users, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        select: {
          id: true,
          email: true,
          username: true,
          role: true,
          premiumUntil: true,
          totalUploads: true,
          totalDownloads: true,
          totalEarnings: true,
          banned: true,
          createdAt: true,
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.user.count({ where }),
    ]);

    return {
      users,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async banUser(userId: string, reason: string) {
    await this.prisma.user.update({
      where: { id: userId },
      data: {
        banned: true,
        banReason: reason,
      },
    });

    return { message: 'User banned successfully' };
  }

  async unbanUser(userId: string) {
    await this.prisma.user.update({
      where: { id: userId },
      data: {
        banned: false,
        banReason: null,
      },
    });

    return { message: 'User unbanned successfully' };
  }

  async getReports(page = 1, limit = 20, reviewed?: boolean) {
    const skip = (page - 1) * limit;
    const where = reviewed !== undefined ? { reviewed } : {};

    const [reports, total] = await Promise.all([
      this.prisma.report.findMany({
        where,
        include: {
          file: {
            select: {
              id: true,
              publicId: true,
              originalName: true,
              userId: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.report.count({ where }),
    ]);

    return {
      reports,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async takedownFile(fileId: string, reason: string) {
    const file = await this.prisma.file.findUnique({
      where: { id: fileId },
    });

    if (!file) {
      throw new NotFoundException('File not found');
    }

    // Mark as taken down
    await this.prisma.file.update({
      where: { id: fileId },
      data: {
        takenDown: true,
        takedownReason: reason,
      },
    });

    // Mark all reports as reviewed
    await this.prisma.report.updateMany({
      where: { fileId },
      data: {
        reviewed: true,
        actionTaken: 'File taken down',
        reviewedAt: new Date(),
      },
    });

    return { message: 'File taken down successfully' };
  }

  async reviewReport(reportId: string, actionTaken: string) {
    await this.prisma.report.update({
      where: { id: reportId },
      data: {
        reviewed: true,
        actionTaken,
        reviewedAt: new Date(),
      },
    });

    return { message: 'Report reviewed successfully' };
  }

  async getPayouts(page = 1, limit = 20, status?: string) {
    const skip = (page - 1) * limit;
    const where = status ? { status: status as any } : {};

    const [payouts, total] = await Promise.all([
      this.prisma.payout.findMany({
        where,
        include: {
          user: {
            select: {
              id: true,
              email: true,
              username: true,
            },
          },
        },
        orderBy: { requestedAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.payout.count({ where }),
    ]);

    return {
      payouts,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async approvePayout(payoutId: string, adminNotes?: string) {
    await this.prisma.payout.update({
      where: { id: payoutId },
      data: {
        status: 'APPROVED',
        adminNotes,
        processedAt: new Date(),
      },
    });

    return { message: 'Payout approved successfully' };
  }

  async rejectPayout(payoutId: string, adminNotes: string) {
    await this.prisma.payout.update({
      where: { id: payoutId },
      data: {
        status: 'REJECTED',
        adminNotes,
        processedAt: new Date(),
      },
    });

    return { message: 'Payout rejected successfully' };
  }

  async markPayoutPaid(payoutId: string) {
    await this.prisma.payout.update({
      where: { id: payoutId },
      data: {
        status: 'PAID',
        paidAt: new Date(),
      },
    });

    return { message: 'Payout marked as paid successfully' };
  }

  async getSiteSettings() {
    const settings = await this.prisma.siteSettings.findMany();
    return settings.reduce((acc, setting) => {
      acc[setting.key] = setting.value;
      return acc;
    }, {});
  }

  async updateSiteSettings(key: string, value: string) {
    await this.prisma.siteSettings.upsert({
      where: { key },
      update: { value },
      create: { key, value },
    });

    return { message: 'Setting updated successfully' };
  }
}
