import {
  BadRequestException,
  Controller,
  Delete,
  Get,
  Patch,
  Post,
  Param,
  Query,
  Body,
  Req,
  UseGuards,
  ParseUUIDPipe,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';

import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PermissionsGuard } from '../rbac/permissions.guard';
import { RequirePermissions } from '../rbac/permissions.decorator';

import { UsersService } from './users.service';
import { VerificationService } from './verification.service';
import { AvatarService } from './avatar.service';
import { ListUsersDto } from './dto/list-users.dto';
import { UpdateUserStatusDto } from './dto/update-user-status.dto';
import { UpdateMyProfileDto } from './dto/update-my-profile.dto';
import { ChangeMyPasswordDto } from './dto/change-my-password.dto';
import { VerifyContactDto } from './dto/verify-contact.dto';

@Controller('users')
export class UsersController {
  constructor(
    private readonly usersService: UsersService,
    private readonly verificationService: VerificationService,
    private readonly avatarService: AvatarService,
  ) {}

  @Get('me')
  @UseGuards(JwtAuthGuard)
  getMyProfile(@Req() request: any) {
    return this.usersService.getMyProfile(request.user.id);
  }

  @Patch('me')
  @UseGuards(JwtAuthGuard)
  updateMyProfile(@Body() dto: UpdateMyProfileDto, @Req() request: any) {
    return this.usersService.updateMyProfile(request.user.id, dto);
  }

  @Post('me/avatar')
  @UseGuards(JwtAuthGuard)
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: {
        fileSize: 5 * 1024 * 1024,
        files: 1,
      },
    }),
  )
  uploadMyAvatar(
    @UploadedFile() file: Express.Multer.File | undefined,
    @Req() request: any,
  ) {
    if (!file?.buffer) {
      throw new BadRequestException('Please select an image file.');
    }

    return this.avatarService.uploadMyAvatar(
      request.user.id,
      file.buffer,
    );
  }

  @Delete('me/avatar')
  @UseGuards(JwtAuthGuard)
  removeMyAvatar(@Req() request: any) {
    return this.avatarService.removeMyAvatar(request.user.id);
  }

  @Patch('me/password')
  @UseGuards(JwtAuthGuard)
  changeMyPassword(
    @Body() dto: ChangeMyPasswordDto,
    @Req() request: any,
  ) {
    return this.usersService.changeMyPassword(
      request.user.id,
      dto.currentPassword,
      dto.newPassword,
    );
  }

  @Post('me/verification/email/request')
  @UseGuards(JwtAuthGuard)
  requestEmailVerification(@Req() request: any) {
    return this.verificationService.requestEmailVerification(
      request.user.id,
    );
  }

  @Post('me/verification/email/verify')
  @UseGuards(JwtAuthGuard)
  verifyEmail(
    @Body() dto: VerifyContactDto,
    @Req() request: any,
  ) {
    return this.verificationService.verifyEmail(
      request.user.id,
      dto.code,
      request.ip || request.socket?.remoteAddress,
    );
  }

  @Get()
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermissions('users.manage')
  listUsers(@Query() dto: ListUsersDto) {
    return this.usersService.listUsers(dto);
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermissions('users.manage')
  getUserDetails(@Param('id', ParseUUIDPipe) id: string) {
    return this.usersService.getUserDetails(id);
  }

  @Patch(':id/status')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermissions('users.manage')
  updateUserStatus(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateUserStatusDto,
    @Req() request: any,
  ) {
    return this.usersService.updateUserStatus(
      id,
      dto.status,
      request.user.id,
      request.ip || request.socket?.remoteAddress,
    );
  }
}
