
import {
  Controller,
  UseGuards,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  ParseUUIDPipe,
  ParseIntPipe,
  DefaultValuePipe,
  BadRequestException,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PermissionsGuard } from '../rbac/permissions.guard';
import { RequirePermissions } from '../rbac/permissions.decorator';

import { isUUID } from 'class-validator';

import { OccurrencesService } from './occurrences.service';
import { CreateOccurrenceDto } from './dto/create-occurrence.dto';
import { UpdateOccurrenceDto } from './dto/update-occurrence.dto';

@Controller()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@RequirePermissions('content.manage')
export class OccurrencesController {
  constructor(
    private readonly occurrencesService: OccurrencesService,
  ) {}

  @Post('questions/:questionId/occurrences')
  create(
    @Param('questionId', new ParseUUIDPipe()) questionId: string,
    @Body() dto: CreateOccurrenceDto,
  ) {
    return this.occurrencesService.create(questionId, dto);
  }

  @Get('questions/:questionId/occurrences')
  findAllByQuestion(
    @Param('questionId', new ParseUUIDPipe()) questionId: string,
  ) {
    return this.occurrencesService.findAllByQuestion(questionId);
  }

  @Get('occurrences')
  findAll(
    @Query('search') search?: string,
    @Query('questionId') questionId?: string,
    @Query('institutionId') institutionId?: string,
    @Query('examId') examId?: string,
    @Query('postId') postId?: string,
    @Query('examYear') examYearText?: string,
    @Query('page', new DefaultValuePipe(1), ParseIntPipe)
    page?: number,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe)
    limit?: number,
  ) {
    const filters = {
      questionId,
      institutionId,
      examId,
      postId,
    };

    for (const [field, value] of Object.entries(filters)) {
      if (value !== undefined && !isUUID(value)) {
        throw new BadRequestException(`Invalid ${field}.`);
      }
    }

    let examYear: number | undefined;

    if (examYearText !== undefined) {
      examYear = Number(examYearText);

      if (
        !Number.isInteger(examYear) ||
        examYear < 1900 ||
        examYear > 2100
      ) {
        throw new BadRequestException(
          'Invalid examYear. Use a year between 1900 and 2100.',
        );
      }
    }

    const safePage = page ?? 1;
    const safeLimit = limit ?? 20;

    if (
      safePage < 1 ||
      safeLimit < 1 ||
      safeLimit > 100
    ) {
      throw new BadRequestException(
        'Page must be positive and limit must be between 1 and 100.',
      );
    }

    return this.occurrencesService.findAll({
      search,
      questionId,
      institutionId,
      examId,
      postId,
      examYear,
      page: safePage,
      limit: safeLimit,
    });
  }

  @Get('occurrences/:id')
  findOne(
    @Param('id', new ParseUUIDPipe()) id: string,
  ) {
    return this.occurrencesService.findOne(id);
  }

  @Put('occurrences/:id')
  update(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: UpdateOccurrenceDto,
  ) {
    return this.occurrencesService.update(id, dto);
  }

  @Delete('occurrences/:id')
  remove(
    @Param('id', new ParseUUIDPipe()) id: string,
  ) {
    return this.occurrencesService.remove(id);
  }
}
