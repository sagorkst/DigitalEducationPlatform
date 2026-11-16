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
  UseGuards,
} from '@nestjs/common';

import { QuestionsService } from './questions.service';
import { QuestionsBulkService } from './questions-bulk.service';
import { CreateQuestionDto } from './dto/create-question.dto';
import { UpdateQuestionDto } from './dto/update-question.dto';
import { BulkUpdateQuestionsDto } from './dto/bulk-update-questions.dto';

import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PermissionsGuard } from '../rbac/permissions.guard';
import { RequirePermissions } from '../rbac/permissions.decorator';

@Controller('questions')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class QuestionsController {
  constructor(
    private readonly questionsService: QuestionsService,
    private readonly questionsBulkService: QuestionsBulkService,
  ) {}

  // BULK UPDATE SELECTED QUESTIONS
  @Post('bulk')
  @RequirePermissions('content.manage')
  @HttpCode(HttpStatus.OK)
  async bulkUpdate(@Body() dto: BulkUpdateQuestionsDto) {
    return this.questionsBulkService.bulkUpdate(dto);
  }

  // PUBLISH ALL ACTIVE DRAFT QUESTIONS
  @Post('bulk/publish-drafts')
  @RequirePermissions('content.manage')
  @HttpCode(HttpStatus.OK)
  async publishAllDrafts() {
    return this.questionsBulkService.publishAllDrafts();
  }

  // CREATE QUESTION
  @Post()
  @RequirePermissions('content.manage')
  @HttpCode(HttpStatus.CREATED)
  async create(@Body() dto: CreateQuestionDto) {
    return this.questionsService.create(dto);
  }

  // GET ALL QUESTIONS
  @Get()
  @RequirePermissions('content.manage')
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

  // GET INSTITUTION AND EXAM GROUP OPTIONS
  @Get('group-options')
  @RequirePermissions('content.manage')
  async getGroupOptions() {
    return this.questionsService.getGroupOptions();
  }

  // GET ALL QUESTIONS FOR ONE EXACT EXAM GROUP
  @Get('by-group')
  @RequirePermissions('content.manage')
  async findByGroup(
    @Query('examId') examId?: string,
    @Query('institution') institution?: string,
    @Query('examName') examName?: string,
    @Query('examYear') examYear?: string,
    @Query('postName') postName?: string,
    @Query('department') department?: string,
  ) {
    return this.questionsService.findByGroup({
      examId,
      institution,
      examName,
      examYear,
      postName,
      department,
    });
  }

  // GET TRASH
  @Get('trash')
  @RequirePermissions('content.manage')
  async getDeletedQuestions(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('search') search?: string,
  ) {
    return this.questionsService.getDeletedQuestions({
      page,
      limit,
      search,
    });
  }

  // GET QUESTION BY ID
  @Get(':id')
  @RequirePermissions('content.manage')
  async findOne(@Param('id') id: string) {
    return this.questionsService.findOne(id);
  }

  // UPDATE QUESTION
  @Put(':id')
  @RequirePermissions('content.manage')
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateQuestionDto,
  ) {
    return this.questionsService.update(id, dto);
  }

  // GET QUESTION HISTORY
  @Get(':id/history')
  @RequirePermissions('content.manage')
  async getHistory(@Param('id') id: string) {
    return this.questionsService.getHistory(id);
  }

  // GET SPECIFIC HISTORY VERSION
  @Get(':id/history/:version')
  @RequirePermissions('content.manage')
  async getHistoryVersion(
    @Param('id') id: string,
    @Param('version', ParseIntPipe) version: number,
  ) {
    return this.questionsService.getHistoryVersion(id, version);
  }

  // RESTORE HISTORY VERSION
  @Post(':id/restore/:version')
  @RequirePermissions('content.manage')
  async restoreHistory(
    @Param('id') id: string,
    @Param('version', ParseIntPipe) version: number,
  ) {
    return this.questionsService.restoreHistory(id, version);
  }

  // SOFT DELETE
  @HttpCode(HttpStatus.OK)
  @Delete(':id')
  @RequirePermissions('content.manage')
  async softDelete(@Param('id') id: string) {
    return this.questionsService.softDelete(id);
  }

  // PERMANENT DELETE
  @HttpCode(HttpStatus.OK)
  @Delete(':id/permanent')
  @RequirePermissions('content.manage')
  async permanentDelete(@Param('id') id: string) {
    return this.questionsService.permanentDelete(id);
  }

  // RECOVER QUESTION
  @HttpCode(HttpStatus.OK)
  @Post(':id/recover')
  @RequirePermissions('content.manage')
  async recover(@Param('id') id: string) {
    return this.questionsService.recover(id);
  }
}