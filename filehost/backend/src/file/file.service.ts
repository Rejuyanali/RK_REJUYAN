import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';
import { S3Service } from '../common/s3/s3.service';
import { User } from '@prisma/client';

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
            premiumUntil: true,
          },
        },
      },
    });

    if (!file) {
      throw new NotFoundException('File not found');
    }

    // Check if file is expired
    if (file.expiresAt && new Date(file.expiresAt) < new Date()) {
      throw new NotFoundException('File has expired');
    }

    if (file.isBanned) {
      throw new ForbiddenException('File has been removed');
    }

    // Increment view count
    await this.prisma.file.update({
      where: { id: file.id },
      data: { viewsCount: { increment: 1 } },
    });

    return file;
  }

  async getFileMetadata(id: string, user?: User) {
    const file = await this.prisma.file.findUnique({
      where: { id },
      include: {
        user: {
          select: {
            id: true,
            username: true,
          },
        },
      },
    });

    if (!file) {
      throw new NotFoundException('File not found');
    }

    // Check permissions for private files
    if (file.visibility === 'PRIVATE' && file.userId !== user?.id) {
      throw new ForbiddenException('Access denied');
    }

    return {
      id: file.id,
      publicId: file.publicId,
      originalName: file.originalName,
      size: file.size.toString(),
      mimeType: file.mimeType,
      description: file.description,
      visibility: file.visibility,
      downloadsCount: file.downloadsCount,
      viewsCount: file.viewsCount,
      createdAt: file.createdAt,
      expiresAt: file.expiresAt,
      uploader: file.user?.username || 'Anonymous',
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
        select: {
          id: true,
          publicId: true,
          originalName: true,
          size: true,
          mimeType: true,
          downloadsCount: true,
          viewsCount: true,
          createdAt: true,
          expiresAt: true,
          visibility: true,
        },
      }),
      this.prisma.file.count({ where: { userId } }),
    ]);

    return {
      files: files.map((f) => ({ ...f, size: f.size.toString() })),
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    };
  }

  async deleteFile(fileId: string, user: User) {
    const file = await this.prisma.file.findUnique({ where: { id: fileId } });

    if (!file) {
      throw new NotFoundException('File not found');
    }

    // Check ownership or admin
    if (file.userId !== user.id && user.role !== 'ADMIN') {
      throw new ForbiddenException('You do not have permission to delete this file');
    }

    // Delete from S3
    await this.s3Service.deleteObject(file.s3Key);
    if (file.thumbnailS3Key) {
      await this.s3Service.deleteObject(file.thumbnailS3Key);
    }

    // Delete from database
    await this.prisma.file.delete({ where: { id: fileId } });

    return { success: true, message: 'File deleted successfully' };
  }

  async reportFile(publicId: string, reporterIp: string, reason: string, description?: string, reporterEmail?: string) {
    const file = await this.prisma.file.findUnique({ where: { publicId } });

    if (!file) {
      throw new NotFoundException('File not found');
    }

    await this.prisma.report.create({
      data: {
        fileId: file.id,
        reporterIp,
        reporterEmail,
        reason,
        description,
      },
    });

    return { success: true, message: 'Report submitted successfully' };
  }
}
