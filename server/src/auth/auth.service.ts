import { Injectable, UnauthorizedException, ConflictException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma/prisma.service';
import * as bcrypt from 'bcrypt';
import { nanoid } from 'nanoid';
import { RegisterDto, LoginDto } from './dto/auth.dto';

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
  ) {}

  async register(dto: RegisterDto) {
    // Check if user exists
    const existingUser = await this.prisma.user.findFirst({
      where: {
        OR: [{ email: dto.email }, { username: dto.username }],
      },
    });

    if (existingUser) {
      throw new ConflictException('User with this email or username already exists');
    }

    // Hash password
    const passwordHash = await bcrypt.hash(dto.password, 10);

    // Create user
    const user = await this.prisma.user.create({
      data: {
        email: dto.email,
        username: dto.username,
        passwordHash,
        apiKey: nanoid(32),
      },
    });

    // Generate tokens
    const tokens = await this.generateTokens(user.id, user.email, user.role);

    return {
      user: this.sanitizeUser(user),
      ...tokens,
    };
  }

  async login(dto: LoginDto) {
    // Find user
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });

    if (!user || !user.passwordHash) {
      throw new UnauthorizedException('Invalid credentials');
    }

    // Check if banned
    if (user.banned) {
      throw new UnauthorizedException('Account is banned');
    }

    // Verify password
    const isPasswordValid = await bcrypt.compare(dto.password, user.passwordHash);
    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    // Generate tokens
    const tokens = await this.generateTokens(user.id, user.email, user.role);

    return {
      user: this.sanitizeUser(user),
      ...tokens,
    };
  }

  async validateUser(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user || user.banned) {
      throw new UnauthorizedException('User not found or banned');
    }

    return this.sanitizeUser(user);
  }

  async validateApiKey(apiKey: string) {
    const user = await this.prisma.user.findUnique({
      where: { apiKey },
    });

    if (!user || user.banned) {
      throw new UnauthorizedException('Invalid API key');
    }

    return this.sanitizeUser(user);
  }

  async googleLogin(profile: any) {
    let user = await this.prisma.user.findUnique({
      where: { googleId: profile.id },
    });

    if (!user) {
      // Check if email exists
      user = await this.prisma.user.findUnique({
        where: { email: profile.emails[0].value },
      });

      if (user) {
        // Link Google account
        user = await this.prisma.user.update({
          where: { id: user.id },
          data: { googleId: profile.id },
        });
      } else {
        // Create new user
        user = await this.prisma.user.create({
          data: {
            email: profile.emails[0].value,
            username: profile.emails[0].value.split('@')[0] + nanoid(4),
            googleId: profile.id,
            apiKey: nanoid(32),
          },
        });
      }
    }

    if (user.banned) {
      throw new UnauthorizedException('Account is banned');
    }

    const tokens = await this.generateTokens(user.id, user.email, user.role);

    return {
      user: this.sanitizeUser(user),
      ...tokens,
    };
  }

  private async generateTokens(userId: string, email: string, role: string) {
    const payload = { sub: userId, email, role };

    const accessToken = this.jwtService.sign(payload);

    return {
      accessToken,
      tokenType: 'Bearer',
    };
  }

  private sanitizeUser(user: any) {
    const { passwordHash, ...sanitized } = user;
    return {
      ...sanitized,
      isPremium: user.premiumUntil ? new Date(user.premiumUntil) > new Date() : false,
    };
  }

  async regenerateApiKey(userId: string) {
    const apiKey = nanoid(32);
    
    await this.prisma.user.update({
      where: { id: userId },
      data: { apiKey },
    });

    return { apiKey };
  }
}
