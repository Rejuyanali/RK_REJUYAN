import { IsNumber, Min } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class TrackDownloadDto {
  @ApiProperty({ example: 1048576 })
  @IsNumber()
  @Min(0)
  bytesServed: number;
}
