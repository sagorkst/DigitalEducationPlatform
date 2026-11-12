import {
  Controller,
  Get,
  Query,
  UseGuards,
} from '@nestjs/common';

import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PermissionsGuard } from '../rbac/permissions.guard';
import { RequirePermissions } from '../rbac/permissions.decorator';

import { AuditService } from './audit.service';
import { ListAuditLogsDto } from './dto/list-audit-logs.dto';

@Controller('audit-logs')
@UseGuards(JwtAuthGuard, PermissionsGuard)
@RequirePermissions('audit.logs.read')
export class AuditController {
  constructor(private readonly auditService: AuditService) {}

  @Get()
  listAuditLogs(@Query() dto: ListAuditLogsDto) {
    return this.auditService.listAuditLogs(dto);
  }
}
