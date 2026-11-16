import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  UseGuards,
  ParseUUIDPipe,
} from '@nestjs/common';

import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { SuperAdminGuard } from './super-admin.guard';
import { RbacService } from './rbac.service';
import { CreateRoleDto } from './dto/create-role.dto';
import { CreatePermissionDto } from './dto/create-permission.dto';
import { AssignRoleDto } from './dto/assign-role.dto';
import { AssignPermissionDto } from './dto/assign-permission.dto';

@Controller('rbac')
@UseGuards(JwtAuthGuard, SuperAdminGuard)
export class RbacController {
  constructor(private readonly rbacService: RbacService) {}

  @Get('roles')
  listRoles() {
    return this.rbacService.listRoles();
  }

  @Post('roles')
  createRole(@Body() dto: CreateRoleDto) {
    return this.rbacService.createRole(dto);
  }

  @Delete('roles/:id')
  deleteRole(@Param('id', ParseUUIDPipe) id: string) {
    return this.rbacService.deleteRole(id);
  }

  @Get('permissions')
  listPermissions() {
    return this.rbacService.listPermissions();
  }

  @Post('permissions')
  createPermission(@Body() dto: CreatePermissionDto) {
    return this.rbacService.createPermission(dto);
  }

  @Post('roles/:roleId/permissions')
  assignPermission(
    @Param('roleId', ParseUUIDPipe) roleId: string,
    @Body() dto: AssignPermissionDto,
  ) {
    return this.rbacService.assignPermission(roleId, dto.permissionId);
  }

  @Delete('roles/:roleId/permissions/:permissionId')
  removePermission(
    @Param('roleId', ParseUUIDPipe) roleId: string,
    @Param('permissionId', ParseUUIDPipe) permissionId: string,
  ) {
    return this.rbacService.removePermission(roleId, permissionId);
  }

  @Post('users/:userId/roles')
  assignRole(
    @Param('userId', ParseUUIDPipe) userId: string,
    @Body() dto: AssignRoleDto,
  ) {
    return this.rbacService.assignRole(userId, dto.roleId);
  }

  @Delete('users/:userId/roles/:roleId')
  removeRole(
    @Param('userId', ParseUUIDPipe) userId: string,
    @Param('roleId', ParseUUIDPipe) roleId: string,
  ) {
    return this.rbacService.removeRole(userId, roleId);
  }
}