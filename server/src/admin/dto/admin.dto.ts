import { IsString, IsOptional } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class BanUserDto {
  @ApiProperty({ example: 'Violation of terms of service' })
  @IsString()
  reason: string;
}

export class TakedownFileDto {
  @ApiProperty({ example: 'DMCA takedown request' })
  @IsString()
  reason: string;
}

export class ReviewReportDto {
  @ApiProperty({ example: 'File reviewed and no action taken' })
  @IsString()
  actionTaken: string;
}

export class ProcessPayoutDto {
  @ApiProperty({ example: 'Approved for payment', required: false })
  @IsOptional()
  @IsString()
  adminNotes?: string;
}

export class UpdateSettingDto {
  @ApiProperty({ example: 'true' })
  @IsString()
  value: string;
}
