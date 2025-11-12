import {
  Controller,
  Get,
  Post,
  Param,
  Body,
  Req,
  Ip,
  Headers,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { DownloadService } from './download.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { TrackDownloadDto } from './dto/download.dto';

@ApiTags('Download')
@Controller('download')
export class DownloadController {
  constructor(private downloadService: DownloadService) {}

  @Get(':publicId/info')
  @ApiOperation({ summary: 'Get download information (wait time, etc.)' })
  async getDownloadInfo(@Param('publicId') publicId: string, @Req() req) {
    return this.downloadService.getDownloadInfo(publicId, req.user?.id);
  }

  @Post(':publicId/generate')
  @ApiOperation({ summary: 'Generate download link after wait time' })
  async generateDownloadLink(
    @Param('publicId') publicId: string,
    @Ip() ip: string,
    @Headers('user-agent') userAgent: string,
    @Req() req,
  ) {
    return this.downloadService.generateDownloadLink(publicId, ip, userAgent, req.user?.id);
  }

  @Post('track/:downloadId')
  @ApiOperation({ summary: 'Track download completion for earnings' })
  async trackDownload(@Param('downloadId') downloadId: string, @Body() dto: TrackDownloadDto) {
    return this.downloadService.trackDownloadCompletion(downloadId, dto.bytesServed);
  }
}
