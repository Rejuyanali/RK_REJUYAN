import { IsString, IsNumber, IsUrl, Min, Max } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class InitiateUploadDto {
  @ApiProperty({ example: 'document.pdf' })
  @IsString()
  fileName: string;

  @ApiProperty({ example: 1048576 })
  @IsNumber()
  @Min(1)
  @Max(5368709120) // 5GB max
  fileSize: number;

  @ApiProperty({ example: 'application/pdf' })
  @IsString()
  mimeType: string;
}

export class RemoteUploadDto {
  @ApiProperty({ example: 'https://example.com/file.pdf' })
  @IsUrl()
  url: string;
}
