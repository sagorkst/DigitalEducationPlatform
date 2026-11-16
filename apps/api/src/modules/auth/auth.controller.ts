import {
  Controller,
  Post,
  Get,
  Body,
  Req,
  UseGuards,
} from '@nestjs/common';
import { Request } from 'express';
import { Throttle } from '@nestjs/throttler';
import {
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';

import { AuthService } from './auth.service';
import { PasswordResetService } from './password-reset.service';
import { SessionService } from './session.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { JwtAuthGuard } from './jwt-auth.guard';

interface AuthenticatedRequest extends Request {
  user: { id: string };
}

class RegistrationTokenDto {
  @IsString()
  @MinLength(20)
  @MaxLength(2000)
  token!: string;
}

class VerifyRegistrationEmailDto extends RegistrationTokenDto {
  @IsString()
  @Matches(/^\d{6}$/, {
    message: 'Verification code must contain exactly 6 digits.',
  })
  code!: string;
}

@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly passwordResetService: PasswordResetService,
    private readonly sessionService: SessionService,
  ) {}

  @Throttle({
    default: {
      limit: 5,
      ttl: 60000,
      blockDuration: 60000,
    },
  })
  @Post('register')
  register(@Body() dto: RegisterDto) {
    return this.authService.register(dto);
  }

  @Throttle({
    default: {
      limit: 5,
      ttl: 60000,
      blockDuration: 60000,
    },
  })
  @Post('register/resend-verification')
  resendRegistrationVerification(
    @Body() dto: RegistrationTokenDto,
  ) {
    return this.authService.resendRegistrationVerification(dto.token);
  }

  @Throttle({
    default: {
      limit: 5,
      ttl: 60000,
      blockDuration: 60000,
    },
  })
  @Post('register/verify-email')
  verifyRegistrationEmail(
    @Body() dto: VerifyRegistrationEmailDto,
    @Req() request: Request,
  ) {
    return this.authService.verifyRegistrationEmail(
      dto.token,
      dto.code,
      request.ip,
    );
  }

  @Throttle({
    default: {
      limit: 5,
      ttl: 60000,
      blockDuration: 60000,
    },
  })
  @Post('login')
  login(@Body() dto: LoginDto) {
    return this.authService.login(dto);
  }

  @Throttle({
    default: {
      limit: 3,
      ttl: 60000,
      blockDuration: 60000,
    },
  })
  @Post('password/forgot')
  forgotPassword(@Body() dto: ForgotPasswordDto) {
    return this.passwordResetService.requestPasswordReset(dto.email);
  }

  @Throttle({
    default: {
      limit: 5,
      ttl: 60000,
      blockDuration: 60000,
    },
  })
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
  @Post('logout')
  logout(@Req() request: AuthenticatedRequest) {
    return this.sessionService.logout(request.user.id);
  }

  @UseGuards(JwtAuthGuard)
  @Get('me')
  getProfile(@Req() request: AuthenticatedRequest) {
    return this.authService.getProfile(request.user.id);
  }
}