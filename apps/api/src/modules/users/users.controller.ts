import {
  Controller, Get, Patch, Param, Query, Body, Req,
  UseGuards, ParseUUIDPipe,
} from '@nestjs/common';

import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PermissionsGuard } from '../rbac/permissions.guard';
import { RequirePermissions } from '../rbac/permissions.decorator';

import { UsersService } from './users.service';
import { ListUsersDto } from './dto/list-users.dto';
import { UpdateUserStatusDto } from './dto/update-user-status.dto';
import { UpdateMyProfileDto } from './dto/update-my-profile.dto';
import { ChangeMyPasswordDto } from './dto/change-my-password.dto';

@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get('me')
  @UseGuards(JwtAuthGuard)
  getMyProfile(@Req() request: any) {
    return this.usersService.getMyProfile(request.user.id);
  }

  @Patch('me')
  @UseGuards(JwtAuthGuard)
  updateMyProfile(
    @Body() dto: UpdateMyProfileDto,
    @Req() request: any,
  ) {
    return this.usersService.updateMyProfile(request.user.id, dto);
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
