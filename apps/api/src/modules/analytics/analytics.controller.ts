import { Controller, Get } from '@nestjs/common';
import { AnalyticsService } from './analytics.service';

@Controller('analytics')
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
