import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsOptional, MaxLength, IsIn } from 'class-validator';

export class InitiateUploadDto {
  @ApiProperty({ example: 'document.pdf' })
  @IsString()
  @MaxLength(255)
  filename: string;

  @ApiProperty({ example: 'application/pdf' })
  @IsString()
  contentType: string;

  @ApiProperty({ example: 'My important document', required: false })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @ApiProperty({ example: 'PUBLIC', enum: ['PUBLIC', 'PRIVATE', 'UNLISTED'], required: false })
  @IsOptional()
  @IsIn(['PUBLIC', 'PRIVATE', 'UNLISTED'])
  visibility?: string;
}
