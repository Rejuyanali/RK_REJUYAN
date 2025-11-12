import {
  Controller,
  Get,
  Post,
  Put,
  Param,
  Query,
  Body,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { AdminService } from './admin.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import {
  BanUserDto,
  TakedownFileDto,
  ReviewReportDto,
  ProcessPayoutDto,
  UpdateSettingDto,
} from './dto/admin.dto';

@ApiTags('Admin')
@Controller('admin')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN')
@ApiBearerAuth()
export class AdminController {
  constructor(private adminService: AdminService) {}

  @Get('dashboard')
  @ApiOperation({ summary: 'Get admin dashboard statistics' })
  async getDashboard() {
    return this.adminService.getDashboardStats();
  }

  @Get('users')
  @ApiOperation({ summary: 'Get all users with pagination' })
  async getUsers(
    @Query('page') page = 1,
    @Query('limit') limit = 20,
    @Query('search') search?: string,
  ) {
    return this.adminService.getUsers(Number(page), Number(limit), search);
  }

  @Post('users/:userId/ban')
  @ApiOperation({ summary: 'Ban a user' })
  async banUser(@Param('userId') userId: string, @Body() dto: BanUserDto) {
    return this.adminService.banUser(userId, dto.reason);
  }

  @Post('users/:userId/unban')
  @ApiOperation({ summary: 'Unban a user' })
  async unbanUser(@Param('userId') userId: string) {
    return this.adminService.unbanUser(userId);
  }

  @Get('reports')
  @ApiOperation({ summary: 'Get file reports' })
  async getReports(
    @Query('page') page = 1,
    @Query('limit') limit = 20,
    @Query('reviewed') reviewed?: string,
  ) {
    const reviewedBool = reviewed === 'true' ? true : reviewed === 'false' ? false : undefined;
    return this.adminService.getReports(Number(page), Number(limit), reviewedBool);
  }

  @Post('takedown/:fileId')
  @ApiOperation({ summary: 'Take down a file (DMCA)' })
  async takedownFile(@Param('fileId') fileId: string, @Body() dto: TakedownFileDto) {
    return this.adminService.takedownFile(fileId, dto.reason);
  }

  @Post('reports/:reportId/review')
  @ApiOperation({ summary: 'Review a report' })
  async reviewReport(@Param('reportId') reportId: string, @Body() dto: ReviewReportDto) {
    return this.adminService.reviewReport(reportId, dto.actionTaken);
  }

  @Get('payouts')
  @ApiOperation({ summary: 'Get payout requests' })
  async getPayouts(
    @Query('page') page = 1,
    @Query('limit') limit = 20,
    @Query('status') status?: string,
  ) {
    return this.adminService.getPayouts(Number(page), Number(limit), status);
  }

  @Post('payouts/:payoutId/approve')
  @ApiOperation({ summary: 'Approve a payout request' })
  async approvePayout(@Param('payoutId') payoutId: string, @Body() dto: ProcessPayoutDto) {
    return this.adminService.approvePayout(payoutId, dto.adminNotes);
  }

  @Post('payouts/:payoutId/reject')
  @ApiOperation({ summary: 'Reject a payout request' })
  async rejectPayout(@Param('payoutId') payoutId: string, @Body() dto: ProcessPayoutDto) {
    return this.adminService.rejectPayout(payoutId, dto.adminNotes);
  }

  @Post('payouts/:payoutId/paid')
  @ApiOperation({ summary: 'Mark payout as paid' })
  async markPayoutPaid(@Param('payoutId') payoutId: string) {
    return this.adminService.markPayoutPaid(payoutId);
  }

  @Get('settings')
  @ApiOperation({ summary: 'Get site settings' })
  async getSettings() {
    return this.adminService.getSiteSettings();
  }

  @Put('settings/:key')
  @ApiOperation({ summary: 'Update site setting' })
  async updateSetting(@Param('key') key: string, @Body() dto: UpdateSettingDto) {
    return this.adminService.updateSiteSettings(key, dto.value);
  }
}
