import {
  Controller,
  Post,
  Get,
  Body,
  Req,
  UseGuards,
} from '@nestjs/common';
import { Request } from 'express';

import { AuthService } from './auth.service';
import { PasswordResetService } from './password-reset.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { JwtAuthGuard } from './jwt-auth.guard';

interface AuthenticatedRequest extends Request {
  user: { id: string };
}

@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly passwordResetService: PasswordResetService,
  ) {}

  @Post('register')
  register(@Body() dto: RegisterDto) {
    return this.authService.register(dto);
  }

  @Post('login')
  login(@Body() dto: LoginDto) {
    return this.authService.login(dto);
  }

  @Post('password/forgot')
  forgotPassword(@Body() dto: ForgotPasswordDto) {
    return this.passwordResetService.requestPasswordReset(dto.email);
  }

  @Post('password/reset')
  resetPassword(
    @Body() dto: ResetPasswordDto,
    @Req() request: Request,
  ) {
    return this.passwordResetService.resetPassword(
      dto.token,
      dto.newPassword,
      request.ip,
    );
  }

  @UseGuards(JwtAuthGuard)
  @Get('me')
  getProfile(@Req() request: AuthenticatedRequest) {
    return this.authService.getProfile(request.user.id);
  }
}