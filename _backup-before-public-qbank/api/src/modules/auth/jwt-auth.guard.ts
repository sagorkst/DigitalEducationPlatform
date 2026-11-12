import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../../database/prisma.service';

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly jwtService: JwtService,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const authorization = request.headers.authorization;

    if (!authorization || !authorization.startsWith('Bearer ')) {
      throw new UnauthorizedException('Bearer token required.');
    }

    const token = authorization.slice(7).trim();

    if (!token) {
      throw new UnauthorizedException('Invalid access token.');
    }

    try {
      const payload = await this.jwtService.verifyAsync<{
        sub: string;
        ver?: number;
      }>(token);

      if (!payload.sub) {
        throw new UnauthorizedException('Invalid access token.');
      }

      const user = await this.prisma.user.findFirst({
        where: {
          id: payload.sub,
          status: 'ACTIVE',
          deletedAt: null,
        },
        include: {
          userRoles: {
            include: {
              role: {
                include: {
                  permissions: {
                    include: {
                      permission: true,
                    },
                  },
                },
              },
            },
          },
        },
      });

      if (!user) {
        throw new UnauthorizedException('User account is not active.');
      }

      if ((payload.ver ?? 0) !== (user.tokenVersion ?? 0)) {
        throw new UnauthorizedException(
          'Session expired. Please log in again.',
        );
      }

      const { passwordHash, userRoles, ...safeUser } = user;

      const roles = userRoles.map((item) => ({
        id: item.role.id,
        name: item.role.name,
      }));

      const permissions = [
        ...new Set(
          userRoles.flatMap((item) =>
            item.role.permissions.map(
              (rolePermission) => rolePermission.permission.key,
            ),
          ),
        ),
      ];

      request.user = {
        ...safeUser,
        roles,
        permissions,
      };

      return true;
    } catch (error) {
      if (error instanceof UnauthorizedException) {
        throw error;
      }

      throw new UnauthorizedException('Invalid or expired access token.');
    }
  }
}