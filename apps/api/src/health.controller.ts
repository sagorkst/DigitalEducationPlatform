
import { Controller, Get } from '@nestjs/common';

@Controller('health')
export class HealthController {
  @Get()
  checkHealth() {
    return {
      success: true,
      application: 'Shikhasetu API',
      status: 'Healthy',
      message: 'API server is running successfully.',
      timestamp: new Date().toISOString(),
    };
  }
}
