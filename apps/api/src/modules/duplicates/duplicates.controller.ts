
import {
  Controller,
  Post,
  Get,
  Put,
  Body,
  Query,
  Param,
  ParseUUIDPipe,
  ParseFloatPipe,
  ParseIntPipe,
  DefaultValuePipe,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';

import { DuplicatesService } from './duplicates.service';
import { CreateDuplicateDto } from './dto/create-duplicate.dto';
import { ReviewDuplicateDto } from './dto/review-duplicate.dto';
import { MergeDuplicateDto } from './dto/merge-duplicate.dto';

@Controller('duplicates')
export class DuplicatesController {
  constructor(
    private readonly duplicatesService: DuplicatesService,
  ) {}

  // CREATE MANUAL DUPLICATE CANDIDATE
  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(@Body() dto: CreateDuplicateDto) {
    return this.duplicatesService.create(dto);
  }

  // AUTOMATIC DUPLICATE DETECTION
  @Post('detect')
  async detect(
    @Query('threshold', new DefaultValuePipe(0.8), ParseFloatPipe)
    threshold: number,
    @Query('limit', new DefaultValuePipe(200), ParseIntPipe)
    limit: number,
  ) {
    return this.duplicatesService.detect(threshold, limit);
  }

  // GET ALL DUPLICATE CANDIDATES
  @Get()
  async findAll(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('status') status?: string,
    @Query('search') search?: string,
  ) {
    return this.duplicatesService.findAll({
      page,
      limit,
      status,
      search,
    });
  }

  // GET DUPLICATE CANDIDATE DETAILS
  @Get(':id')
  async findOne(
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.duplicatesService.findOne(id);
  }

  // CONFIRM OR REJECT DUPLICATE
  @Put(':id/review')
  async review(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ReviewDuplicateDto,
  ) {
    return this.duplicatesService.review(id, dto);
  }

  // MERGE CONFIRMED DUPLICATE QUESTIONS
  @Post(':id/merge')
  async merge(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: MergeDuplicateDto,
  ) {
    return this.duplicatesService.merge(id, dto);
  }
}
