import {
  Injectable,
  UnauthorizedException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../common/prisma/prisma.service';
import * as bcrypt from 'bcrypt';
import { nanoid } from 'nanoid';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { User } from '@prisma/client';

export interface JwtPayload {
  sub: string;
  email: string;
  role: string;
}

export interface AuthResponse {
  accessToken: string;
  user: {
    id: string;
    username: string;
    email: string;
    role: string;
    isPremium: boolean;
    premiumUntil: Date | null;
  };
}

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
  ) {}

  async register(dto: RegisterDto): Promise<AuthResponse> {
    // Check if user already exists
    const existingUser = await this.prisma.user.findFirst({
      where: {
        OR: [{ email: dto.email }, { username: dto.username }],
      },
    });

    if (existingUser) {
      if (existingUser.email === dto.email) {
        throw new ConflictException('Email already registered');
      }
      throw new ConflictException('Username already taken');
    }

    // Hash password
    const passwordHash = await bcrypt.hash(dto.password, 10);

    // Create user with API key
    const user = await this.prisma.user.create({
      data: {
        username: dto.username,
        email: dto.email,
        passwordHash,
        apiKey: `fh_${nanoid(32)}`,
      },
    });

    return this.generateAuthResponse(user);
  }

  async login(dto: LoginDto): Promise<AuthResponse> {
    const user = await this.validateUser(dto.email, dto.password);
    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    if (user.isBanned) {
      throw new UnauthorizedException('Account is banned');
    }

    if (!user.isActive) {
      throw new UnauthorizedException('Account is inactive');
    }

    return this.generateAuthResponse(user);
  }

  async validateUser(email: string, password: string): Promise<User | null> {
    const user = await this.prisma.user.findUnique({
      where: { email },
    });

    if (!user || !user.passwordHash) {
      return null;
    }

    const isPasswordValid = await bcrypt.compare(password, user.passwordHash);
    if (!isPasswordValid) {
      return null;
    }

    return user;
  }

  async validateUserById(userId: string): Promise<User | null> {
    return this.prisma.user.findUnique({
      where: { id: userId },
    });
  }

  async validateApiKey(apiKey: string): Promise<User | null> {
    if (!apiKey || !apiKey.startsWith('fh_')) {
      return null;
    }

    return this.prisma.user.findUnique({
      where: { apiKey },
    });
  }

  async googleLogin(profile: any): Promise<AuthResponse> {
    let user = await this.prisma.user.findUnique({
      where: { googleId: profile.id },
    });

    if (!user) {
      // Check if email already exists
      const existingEmail = await this.prisma.user.findUnique({
        where: { email: profile.emails[0].value },
      });

      if (existingEmail) {
        // Link Google account to existing user
        user = await this.prisma.user.update({
          where: { email: profile.emails[0].value },
          data: { googleId: profile.id },
        });
      } else {
        // Create new user
        const username = profile.emails[0].value.split('@')[0] + '_' + nanoid(4);
        user = await this.prisma.user.create({
          data: {
            googleId: profile.id,
            email: profile.emails[0].value,
            username,
            apiKey: `fh_${nanoid(32)}`,
          },
        });
      }
    }

    if (user.isBanned) {
      throw new UnauthorizedException('Account is banned');
    }

    return this.generateAuthResponse(user);
  }

  async regenerateApiKey(userId: string): Promise<{ apiKey: string }> {
    const apiKey = `fh_${nanoid(32)}`;
    await this.prisma.user.update({
      where: { id: userId },
      data: { apiKey },
    });

    return { apiKey };
  }

  private generateAuthResponse(user: User): AuthResponse {
    const payload: JwtPayload = {
      sub: user.id,
      email: user.email,
      role: user.role,
    };

    const accessToken = this.jwtService.sign(payload);

    const isPremium = user.premiumUntil ? new Date(user.premiumUntil) > new Date() : false;

    return {
      accessToken,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        role: user.role,
        isPremium,
        premiumUntil: user.premiumUntil,
      },
    };
  }

  async verifyToken(token: string): Promise<JwtPayload> {
    try {
      return this.jwtService.verify(token);
    } catch (error) {
      throw new UnauthorizedException('Invalid token');
    }
  }
}
