import { Controller, Post, Body, Get, UseGuards, Req } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiResponse } from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { GoogleAuthGuard } from './guards/google-auth.guard';
import { Public } from '../common/decorators/public.decorator';
import { CurrentUser } from '../common/decorators/user.decorator';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  @Public()
  @Post('register')
  @ApiOperation({ summary: 'Register a new user' })
  @ApiResponse({ status: 201, description: 'User successfully registered' })
  @ApiResponse({ status: 409, description: 'Email or username already exists' })
  async register(@Body() dto: RegisterDto) {
    return this.authService.register(dto);
  }

  @Public()
  @Post('login')
  @ApiOperation({ summary: 'Login with email and password' })
  @ApiResponse({ status: 200, description: 'Successfully logged in' })
  @ApiResponse({ status: 401, description: 'Invalid credentials' })
  async login(@Body() dto: LoginDto) {
    return this.authService.login(dto);
  }

  @Public()
  @Get('oauth/google')
  @UseGuards(GoogleAuthGuard)
  @ApiOperation({ summary: 'Initiate Google OAuth login' })
  async googleLogin() {
    // Guard redirects to Google
  }

  @Public()
  @Get('oauth/google/callback')
  @UseGuards(GoogleAuthGuard)
  @ApiOperation({ summary: 'Google OAuth callback' })
  async googleCallback(@Req() req: any) {
    return this.authService.googleLogin(req.user);
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get current user profile' })
  async getProfile(@CurrentUser() user: any) {
    return {
      id: user.id,
      username: user.username,
      email: user.email,
      role: user.role,
      isPremium: user.premiumUntil ? new Date(user.premiumUntil) > new Date() : false,
      premiumUntil: user.premiumUntil,
      apiKey: user.apiKey,
      createdAt: user.createdAt,
    };
  }

  @Post('api-key/regenerate')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Regenerate API key' })
  async regenerateApiKey(@CurrentUser('id') userId: string) {
    return this.authService.regenerateApiKey(userId);
  }
}
