import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { S3Service } from '../s3/s3.service';

@Injectable()
export class FileService {
  constructor(
    private prisma: PrismaService,
    private s3Service: S3Service,
  ) {}

  async getFileByPublicId(publicId: string) {
    const file = await this.prisma.file.findUnique({
      where: { publicId },
      include: {
        user: {
          select: {
            id: true,
            username: true,
            role: true,
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

    // Check expiration
    if (file.expiresAt && new Date(file.expiresAt) < new Date()) {
      throw new NotFoundException('File has expired');
    }

    // Increment views
    await this.prisma.file.update({
      where: { id: file.id },
      data: { viewsCount: { increment: 1 } },
    });

    return {
      ...file,
      size: file.size.toString(),
      thumbnailUrl: file.thumbnailS3Key
        ? await this.s3Service.getPresignedDownloadUrl(file.thumbnailS3Key, 3600)
        : null,
    };
  }

  async getUserFiles(userId: string, page = 1, limit = 20) {
    const skip = (page - 1) * limit;

    const [files, total] = await Promise.all([
      this.prisma.file.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.file.count({ where: { userId } }),
    ]);

    return {
      files: files.map((f) => ({
        ...f,
        size: f.size.toString(),
      })),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async deleteFile(fileId: string, userId: string, isAdmin = false) {
    const file = await this.prisma.file.findUnique({
      where: { id: fileId },
    });

    if (!file) {
      throw new NotFoundException('File not found');
    }

    if (!isAdmin && file.userId !== userId) {
      throw new ForbiddenException('You do not have permission to delete this file');
    }

    // Delete from S3
    try {
      await this.s3Service.deleteFile(file.s3Key);
      if (file.thumbnailS3Key) {
        await this.s3Service.deleteFile(file.thumbnailS3Key);
      }
    } catch (error) {
      console.error('Error deleting from S3:', error);
    }

    // Delete from database
    await this.prisma.file.delete({
      where: { id: fileId },
    });

    return { message: 'File deleted successfully' };
  }

  async reportFile(publicId: string, reporterIp: string, reason: string, details?: string) {
    const file = await this.prisma.file.findUnique({
      where: { publicId },
    });

    if (!file) {
      throw new NotFoundException('File not found');
    }

    await this.prisma.report.create({
      data: {
        fileId: file.id,
        reporterIp,
        reason,
        details,
      },
    });

    // Mark file as reported
    await this.prisma.file.update({
      where: { id: file.id },
      data: { reported: true },
    });

    return { message: 'Report submitted successfully' };
  }
}
