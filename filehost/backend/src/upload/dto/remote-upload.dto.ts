import { ApiProperty } from '@nestjs/swagger';
import { IsUrl, IsOptional, IsString, MaxLength, IsIn } from 'class-validator';

export class RemoteUploadDto {
  @ApiProperty({ example: 'https://example.com/file.pdf' })
  @IsUrl()
  url: string;

  @ApiProperty({ example: 'My imported file', required: false })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @ApiProperty({ example: 'PUBLIC', enum: ['PUBLIC', 'PRIVATE', 'UNLISTED'], required: false })
  @IsOptional()
  @IsIn(['PUBLIC', 'PRIVATE', 'UNLISTED'])
  visibility?: string;
}
