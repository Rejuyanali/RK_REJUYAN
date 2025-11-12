import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy } from 'passport-custom';
import { AuthService } from '../auth.service';

@Injectable()
export class ApiKeyStrategy extends PassportStrategy(Strategy, 'api-key') {
  constructor(private authService: AuthService) {
    super();
  }

  async validate(req: Request): Promise<any> {
    const apiKey = req.headers['x-api-key'];

    if (!apiKey || typeof apiKey !== 'string') {
      throw new UnauthorizedException('API key is required');
    }

    const user = await this.authService.validateApiKey(apiKey);
    if (!user) {
      throw new UnauthorizedException('Invalid API key');
    }

    if (user.isBanned) {
      throw new UnauthorizedException('Account is banned');
    }

    return user;
  }
}
