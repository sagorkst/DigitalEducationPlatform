import {
  Body,
  Controller,
  UseGuards,
  Get,
  Param,
  Post,
  Query,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PermissionsGuard } from '../rbac/permissions.guard';
import { RequirePermissions } from '../rbac/permissions.decorator';

import { ReviewsService } from './reviews.service';
import { SubmitReviewDto } from './dto/submit-review.dto';
import { RejectReviewDto } from './dto/reject-review.dto';

@Controller('reviews')
@UseGuards(JwtAuthGuard, PermissionsGuard)
@RequirePermissions('questions.review')
export class ReviewsController {
  constructor(private readonly reviewsService: ReviewsService) {}

  @Post('questions/:questionId/submit')
  submit(
    @Param('questionId') questionId: string,
    @Body() dto: SubmitReviewDto,
  ) {
    return this.reviewsService.submit(questionId, dto);
  }

  @Get()
  findAll(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('status') status?: string,
    @Query('questionId') questionId?: string,
    @Query('search') search?: string,
  ) {
    return this.reviewsService.findAll({
      page,
      limit,
      status,
      questionId,
      search,
    });
  }

  @Get('questions/:questionId/history')
  getQuestionHistory(@Param('questionId') questionId: string) {
    return this.reviewsService.getQuestionHistory(questionId);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.reviewsService.findOne(id);
  }

  @Post(':id/approve')
  approve(@Param('id') id: string) {
    return this.reviewsService.approve(id);
  }

  @Post(':id/reject')
  reject(
    @Param('id') id: string,
    @Body() dto: RejectReviewDto,
  ) {
    return this.reviewsService.reject(id, dto.reviewNote);
  }

  @Post(':id/cancel')
  cancel(@Param('id') id: string) {
    return this.reviewsService.cancel(id);
  }
}
