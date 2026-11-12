import { Controller, Get, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PermissionsGuard } from '../rbac/permissions.guard';
import { RequirePermissions } from '../rbac/permissions.decorator';
import { AnalyticsService } from './analytics.service';

@Controller('analytics')
@UseGuards(JwtAuthGuard, PermissionsGuard)
@RequirePermissions('analytics.read')
export class AnalyticsController {
  constructor(private readonly analyticsService: AnalyticsService) {}

  @Get('overview')
  overview() {
    return this.analyticsService.overview();
  }

  @Get('questions/by-subject')
  questionsBySubject() {
    return this.analyticsService.questionsBySubject();
  }

  @Get('questions/by-topic')
  questionsByTopic() {
    return this.analyticsService.questionsByTopic();
  }

  @Get('questions/by-exam')
  questionsByExam() {
    return this.analyticsService.questionsByExam();
  }

  @Get('reviews')
  reviewReport() {
    return this.analyticsService.reviewReport();
  }

  @Get('duplicates')
  duplicateReport() {
    return this.analyticsService.duplicateReport();
  }

  @Get('imports')
  importReport() {
    return this.analyticsService.importReport();
  }

  @Get('question-quality')
  questionQuality() {
    return this.analyticsService.questionQuality();
  }
}
