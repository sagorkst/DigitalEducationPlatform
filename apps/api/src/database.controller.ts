import { Controller, Get } from '@nestjs/common';
import { PrismaService } from './database/prisma.service';

@Controller('database')
export class DatabaseController {
  constructor(private readonly prisma: PrismaService) {}

  @Get('test')
  async testConnection() {
    try {
      await this.prisma.$queryRaw`SELECT 1`;

      return {
        success: true,
        database: 'Connected',
        message: 'PostgreSQL connection is working successfully.',
      };
        } catch (error) {
      console.error('DATABASE QUERY ERROR:', error);

      return {
        success: false,
        database: 'Disconnected',
        message: 'Database connection failed.',
      };
    }
  }
}