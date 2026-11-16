import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';

interface RequestRole {
  id?: string;
  name?: string;
}

@Injectable()
export class SuperAdminGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();

    const roles: Array<string | RequestRole> = request.user?.roles ?? [];

    const isSuperAdmin = roles.some((role) => {
      if (typeof role === 'string') {
        return role === 'SUPER_ADMIN';
      }

      return role?.name === 'SUPER_ADMIN';
    });

    if (!isSuperAdmin) {
      throw new ForbiddenException(
        'Only SUPER_ADMIN can manage roles and permissions.',
      );
    }

    return true;
  }
}