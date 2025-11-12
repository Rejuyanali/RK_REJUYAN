import {
  Controller,
  Post,
  Body,
  UseGuards,
  Param,
  Patch,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiSecurity,
  ApiResponse,
} from '@nestjs/swagger';
import { UploadService } from './upload.service';
import { InitiateUploadDto } from './dto/initiate-upload.dto';
import { RemoteUploadDto } from './dto/remote-upload.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ApiKeyGuard } from '../auth/guards/api-key.guard';
import { CurrentUser } from '../common/decorators/user.decorator';
import { Public } from '../common/decorators/public.decorator';
import { User } from '@prisma/client';

@ApiTags('upload')
@Controller('upload')
export class UploadController {
  constructor(private uploadService: UploadService) {}

  @Post('initiate')
  @ApiOperation({ summary: 'Initiate file upload and get presigned URL' })
  @ApiBearerAuth()
  @ApiSecurity('api-key')
  @ApiResponse({ status: 201, description: 'Presigned upload URL generated' })
  async initiateUpload(
    @Body() dto: InitiateUploadDto,
    @CurrentUser() user?: User,
  ) {
    return this.uploadService.initiateUpload(dto, user);
  }

  @Patch(':fileId/complete')
  @ApiOperation({ summary: 'Mark upload as complete' })
  @ApiBearerAuth()
  @ApiSecurity('api-key')
  @ApiResponse({ status: 200, description: 'Upload completed' })
  async completeUpload(@Param('fileId') fileId: string) {
    return this.uploadService.completeUpload(fileId);
  }

  @Post('remote')
  @ApiOperation({ summary: 'Upload file from remote URL' })
  @ApiBearerAuth()
  @ApiSecurity('api-key')
  @ApiResponse({ status: 201, description: 'Remote upload initiated' })
  async remoteUpload(
    @Body() dto: RemoteUploadDto,
    @CurrentUser() user?: User,
  ) {
    return this.uploadService.initiateRemoteUpload(dto, user);
  }
}
