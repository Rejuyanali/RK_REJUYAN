import {
  Controller,
  Get,
  Delete,
  Post,
  Param,
  Query,
  Body,
  UseGuards,
  Ip,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiResponse,
  ApiQuery,
} from '@nestjs/swagger';
import { FileService } from './file.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/user.decorator';
import { Public } from '../common/decorators/public.decorator';
import { User } from '@prisma/client';

@ApiTags('file')
@Controller('file')
export class FileController {
  constructor(private fileService: FileService) {}

  @Public()
  @Get(':publicId')
  @ApiOperation({ summary: 'Get file by public ID (for landing page)' })
  @ApiResponse({ status: 200, description: 'File found' })
  @ApiResponse({ status: 404, description: 'File not found' })
  async getFile(@Param('publicId') publicId: string) {
    return this.fileService.getFileByPublicId(publicId);
  }

  @Public()
  @Get(':id/metadata')
  @ApiOperation({ summary: 'Get file metadata' })
  async getFileMetadata(@Param('id') id: string, @CurrentUser() user?: User) {
    return this.fileService.getFileMetadata(id, user);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Delete a file' })
  async deleteFile(@Param('id') id: string, @CurrentUser() user: User) {
    return this.fileService.deleteFile(id, user);
  }

  @Public()
  @Post(':publicId/report')
  @ApiOperation({ summary: 'Report a file (DMCA/abuse)' })
  async reportFile(
    @Param('publicId') publicId: string,
    @Ip() ip: string,
    @Body() body: { reason: string; description?: string; email?: string },
  ) {
    return this.fileService.reportFile(
      publicId,
      ip,
      body.reason,
      body.description,
      body.email,
    );
  }
}
