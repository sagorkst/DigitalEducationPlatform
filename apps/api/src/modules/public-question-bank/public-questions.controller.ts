import { Controller, Get, Param, Query } from '@nestjs/common';
import { PublicQuestionsService } from './public-questions.service';

@Controller('public')
export class PublicQuestionsController {
  constructor(private readonly service: PublicQuestionsService) {}

  @Get('exams')
  exams(
    @Query('search') search?: string,
    @Query('institutionId') institutionId?: string,
    @Query('postId') postId?: string,
    @Query('examId') examId?: string,
    @Query('grade') grade?: string,
    @Query('examType') examType?: string,
    @Query('hasAnswer') hasAnswer?: string,
    @Query('hasExplanation') hasExplanation?: string,
    @Query('examYear') examYear?: string,
    @Query('yearFrom') yearFrom?: string,
    @Query('yearTo') yearTo?: string,
    @Query('subjectId') subjectId?: string,
    @Query('topicId') topicId?: string,
    @Query('difficulty') difficulty?: string,
    @Query('questionType') questionType?: string,
  ) {
    return this.service.exams({
      search,
      institutionId,
      postId,
      examId,
      grade,
      examType,
      hasAnswer,
      hasExplanation,
      examYear,
      yearFrom,
      yearTo,
      subjectId,
      topicId,
      difficulty,
      questionType,
    });
  }

  @Get('questions')
  findAll(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('search') search?: string,
    @Query('subjectId') subjectId?: string,
    @Query('topicId') topicId?: string,
    @Query('institutionId') institutionId?: string,
    @Query('institution') institution?: string,
    @Query('examId') examId?: string,
    @Query('exam') exam?: string,
    @Query('examYear') examYear?: string,
    @Query('postId') postId?: string,
    @Query('post') post?: string,
    @Query('grade') grade?: string,
    @Query('examType') examType?: string,
    @Query('hasAnswer') hasAnswer?: string,
    @Query('hasExplanation') hasExplanation?: string,
    @Query('yearFrom') yearFrom?: string,
    @Query('yearTo') yearTo?: string,
    @Query('questionType') questionType?: string,
    @Query('difficulty') difficulty?: string,
    @Query('isRepeated') isRepeated?: string,
    @Query('sort') sort?: string,
  ) {
    return this.service.findAll({
      page,
      limit,
      search,
      subjectId,
      topicId,
      institutionId,
      examId,
      exam,
      examYear,
      institution,
      postId,
      post,
      grade,
      examType,
      hasAnswer,
      hasExplanation,
      yearFrom,
      yearTo,
      questionType,
      difficulty,
      isRepeated,
      sort,
    });
  }

  @Get('questions/:id')
  findOne(
    @Param('id') id: string,
    @Query('examId') examId?: string,
  ) {
    return this.service.findOne(id, examId);
  }

  @Get('subjects')
  subjects() {
    return this.service.subjects();
  }

  @Get('topics')
  topics(@Query('subjectId') subjectId?: string) {
    return this.service.topics(subjectId);
  }

  @Get('filters')
  filters() {
    return this.service.filterOptions();
  }
}

