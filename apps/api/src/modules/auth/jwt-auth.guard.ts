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

    if (
      !authorization ||
      !authorization.startsWith('Bearer ')
    ) {
      throw new UnauthorizedException('Bearer token required.');
    }

    const token = authorization.slice(7).trim();

    if (!token) {
      throw new UnauthorizedException('Invalid access token.');
    }

    try {
      const payload = await this.jwtService.verifyAsync<{
        sub: string;
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
          memberships: {
            where: {
              status: 'ACTIVE',
            },
            include: {
              organization: true,
              roles: {
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
          },
        },
      });

      if (!user) {
        throw new UnauthorizedException(
          'User account is not active.',
        );
      }

      const { passwordHash, ...safeUser } = user;

      request.user = {
        ...safeUser,
        memberships: user.memberships
          .filter(
            (membership) =>
              membership.organization.status === 'ACTIVE' &&
              membership.organization.deletedAt === null,
          )
          .map((membership) => ({
            id: membership.id,
            organization: membership.organization,
            roles: membership.roles.map((membershipRole) => ({
              id: membershipRole.role.id,
              name: membershipRole.role.name,
              permissions: membershipRole.role.permissions.map(
                (rolePermission) => rolePermission.permission.key,
              ),
            })),
          })),
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
