import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { REQUIRED_PERMISSIONS_KEY } from './permissions.decorator';

@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const required =
      this.reflector.getAllAndOverride<string[]>(
        REQUIRED_PERMISSIONS_KEY,
        [context.getHandler(), context.getClass()],
      ) || [];

    if (!required.length) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const granted = new Set<string>(
      request.user?.permissions || [],
    );

    const allowed = required.every((permission) =>
      granted.has(permission),
    );

    if (!allowed) {
      throw new ForbiddenException('আপনার এই কাজের অনুমতি নেই।');
    }

    return true;
  }
}