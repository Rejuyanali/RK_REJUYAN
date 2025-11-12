import { IsString, IsOptional, MaxLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class ReportFileDto {
  @ApiProperty({ example: 'copyright', enum: ['copyright', 'abuse', 'malware', 'other'] })
  @IsString()
  reason: string;

  @ApiProperty({ example: 'This file contains copyrighted material', required: false })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  details?: string;
}
