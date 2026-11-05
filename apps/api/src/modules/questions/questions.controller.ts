
import {
  Controller,
  Post,
  Get,
  Put,
  Delete,
  Body,
  Query,
  Param,
  ParseIntPipe,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';

import { QuestionsService } from './questions.service';
import { CreateQuestionDto } from './dto/create-question.dto';
import { UpdateQuestionDto } from './dto/update-question.dto';

@Controller('questions')
export class QuestionsController {
  constructor(
    private readonly questionsService: QuestionsService,
  ) {}

  // CREATE QUESTION
  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(@Body() dto: CreateQuestionDto) {
    return this.questionsService.create(dto);
  }

  // GET ALL QUESTIONS + FILTERS
  @Get()
  async findAll(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('search') search?: string,
    @Query('yearFrom') yearFrom?: string,
    @Query('yearTo') yearTo?: string,
    @Query('institution') institution?: string,
    @Query('exam') exam?: string,
    @Query('post') post?: string,
    @Query('subject') subject?: string,
    @Query('topic') topic?: string,
    @Query('questionType') questionType?: string,
    @Query('difficulty') difficulty?: string,
    @Query('status') status?: string,
    @Query('hasAnswer') hasAnswer?: string,
    @Query('hasExplanation') hasExplanation?: string,
    @Query('isRepeated') isRepeated?: string,
  ) {
    return this.questionsService.findAll({
      page,
      limit,
      search,
      yearFrom,
      yearTo,
      institution,
      exam,
      post,
      subject,
      topic,
      questionType,
      difficulty,
      status,
      hasAnswer,
      hasExplanation,
      isRepeated,
    });
  }

  // GET QUESTION BY ID
  @Get(':id')
  async findOne(@Param('id') id: string) {
    return this.questionsService.findOne(id);
  }

  // UPDATE QUESTION
  @Put(':id')
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateQuestionDto,
  ) {
    return this.questionsService.update(id, dto);
  }

  // GET ALL HISTORY VERSIONS
  @Get(':id/history')
  async getHistory(@Param('id') id: string) {
    return this.questionsService.getHistory(id);
  }

  // GET A SPECIFIC HISTORY VERSION
  @Get(':id/history/:version')
  async getHistoryVersion(
    @Param('id') id: string,
    @Param('version', ParseIntPipe) version: number,
  ) {
    return this.questionsService.getHistoryVersion(id, version);
  }

  // RESTORE A HISTORY VERSION
  @Post(':id/restore/:version')
  async restoreHistory(
    @Param('id') id: string,
    @Param('version', ParseIntPipe) version: number,
  ) {
    return this.questionsService.restoreHistory(id, version);
  }

  // SOFT DELETE QUESTION
  @HttpCode(HttpStatus.OK)
  @Delete(':id')
  async softDelete(@Param('id') id: string) {
    return this.questionsService.softDelete(id);
  }

  // RECOVER DELETED QUESTION
  @HttpCode(HttpStatus.OK)
  @Post(':id/recover')
  async recover(@Param('id') id: string) {
    return this.questionsService.recover(id);
  }
}
