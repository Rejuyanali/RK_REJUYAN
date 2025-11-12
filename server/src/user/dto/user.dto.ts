import { IsString, IsEmail } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class RequestPayoutDto {
  @ApiProperty({ example: 'paypal', enum: ['paypal', 'stripe', 'crypto'] })
  @IsString()
  paymentMethod: string;

  @ApiProperty({ example: 'user@example.com' })
  @IsEmail()
  paymentEmail: string;
}
