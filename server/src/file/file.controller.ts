import {
  Controller,
  Get,
  Delete,
  Post,
  Param,
  Query,
  Body,
  UseGuards,
  Req,
  Ip,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { FileService } from './file.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ReportFileDto } from './dto/file.dto';

@ApiTags('Files')
@Controller('file')
export class FileController {
  constructor(private fileService: FileService) {}

  @Get(':publicId/metadata')
  @ApiOperation({ summary: 'Get file metadata by public ID' })
  async getFileMetadata(@Param('publicId') publicId: string) {
    return this.fileService.getFileByPublicId(publicId);
  }

  @Delete(':fileId')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Delete a file' })
  async deleteFile(@Param('fileId') fileId: string, @Req() req) {
    return this.fileService.deleteFile(fileId, req.user.id);
  }

  @Post(':publicId/report')
  @ApiOperation({ summary: 'Report a file for DMCA or abuse' })
  async reportFile(
    @Param('publicId') publicId: string,
    @Body() dto: ReportFileDto,
    @Ip() ip: string,
  ) {
    return this.fileService.reportFile(publicId, ip, dto.reason, dto.details);
  }
}
