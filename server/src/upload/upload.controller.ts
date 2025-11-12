import { Controller, Post, Body, Get, Param, UseGuards, Req } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiSecurity } from '@nestjs/swagger';
import { UploadService } from './upload.service';
import { InitiateUploadDto, RemoteUploadDto } from './dto/upload.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ApiKeyGuard } from '../auth/guards/api-key.guard';

@ApiTags('Upload')
@Controller('upload')
export class UploadController {
  constructor(private uploadService: UploadService) {}

  @Post('initiate')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Initiate file upload and get presigned URL' })
  async initiateUpload(@Body() dto: InitiateUploadDto, @Req() req) {
    return this.uploadService.initiateUpload(
      dto.fileName,
      dto.fileSize,
      dto.mimeType,
      req.user?.id,
    );
  }

  @Post('initiate-anonymous')
  @ApiOperation({ summary: 'Initiate anonymous file upload' })
  async initiateAnonymousUpload(@Body() dto: InitiateUploadDto) {
    return this.uploadService.initiateUpload(dto.fileName, dto.fileSize, dto.mimeType);
  }

  @Post('remote')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Upload file from remote URL' })
  async uploadFromRemote(@Body() dto: RemoteUploadDto, @Req() req) {
    return this.uploadService.uploadFromRemoteUrl(dto.url, req.user?.id);
  }

  @Post('remote-api')
  @UseGuards(ApiKeyGuard)
  @ApiSecurity('api-key')
  @ApiOperation({ summary: 'Upload file from remote URL using API key' })
  async uploadFromRemoteApi(@Body() dto: RemoteUploadDto, @Req() req) {
    return this.uploadService.uploadFromRemoteUrl(dto.url, req.user?.id);
  }

  @Get('status/:jobId')
  @ApiOperation({ summary: 'Get upload job status' })
  async getUploadStatus(@Param('jobId') jobId: string) {
    return this.uploadService.getUploadStatus(jobId);
  }
}
