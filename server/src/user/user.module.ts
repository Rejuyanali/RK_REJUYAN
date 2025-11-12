import { Module } from '@nestjs/common';
import { UserController } from './user.controller';
import { UserService } from './user.service';
import { FileModule } from '../file/file.module';

@Module({
  imports: [FileModule],
  controllers: [UserController],
  providers: [UserService],
})
export class UserModule {}
