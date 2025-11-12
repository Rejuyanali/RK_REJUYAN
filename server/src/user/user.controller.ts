import { Controller, Get, Post, Body, Query, UseGuards, Req } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { UserService } from './user.service';
import { FileService } from '../file/file.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RequestPayoutDto } from './dto/user.dto';

@ApiTags('User')
@Controller('user')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class UserController {
  constructor(
    private userService: UserService,
    private fileService: FileService,
  ) {}

  @Get('stats')
  @ApiOperation({ summary: 'Get user statistics and earnings' })
  async getUserStats(@Req() req) {
    return this.userService.getUserStats(req.user.id);
  }

  @Get('files')
  @ApiOperation({ summary: 'Get user uploaded files' })
  async getUserFiles(@Req() req, @Query('page') page = 1, @Query('limit') limit = 20) {
    return this.fileService.getUserFiles(req.user.id, Number(page), Number(limit));
  }

  @Post('payout/request')
  @ApiOperation({ summary: 'Request payout for earnings' })
  async requestPayout(@Req() req, @Body() dto: RequestPayoutDto) {
    return this.userService.requestPayout(req.user.id, dto.paymentMethod, dto.paymentEmail);
  }

  @Get('payout/history')
  @ApiOperation({ summary: 'Get payout history' })
  async getPayoutHistory(@Req() req) {
    return this.userService.getPayoutHistory(req.user.id);
  }
}
