
import {
  Controller,
  Post,
  Get,
  Put,
  Delete,
  Body,
  Query,
  Param,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';

import { SubjectsService } from './subjects.service';
import { CreateSubjectDto } from './dto/create-subject.dto';
import { UpdateSubjectDto } from './dto/update-subject.dto';

@Controller('subjects')
export class SubjectsController {
  constructor(
    private readonly subjectsService: SubjectsService,
  ) {}

  // ==========================================
  // CREATE SUBJECT
  // POST /api/subjects
  // ==========================================

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(@Body() dto: CreateSubjectDto) {
    return this.subjectsService.create(dto);
  }

  // ==========================================
  // GET ALL SUBJECTS
  // GET /api/subjects
  // ==========================================

  @Get()
  async findAll(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('search') search?: string,
    @Query('isActive') isActive?: string,
  ) {
    return this.subjectsService.findAll({
      page,
      limit,
      search,
      isActive,
    });
  }

  // ==========================================
  // GET SUBJECT BY ID
  // GET /api/subjects/:id
  // ==========================================

  @Get(':id')
  async findOne(@Param('id') id: string) {
    return this.subjectsService.findOne(id);
  }

  // ==========================================
  // UPDATE SUBJECT
  // PUT /api/subjects/:id
  // ==========================================

  @Put(':id')
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateSubjectDto,
  ) {
    return this.subjectsService.update(id, dto);
  }

  // ==========================================
  // DELETE SUBJECT
  // DELETE /api/subjects/:id
  // ==========================================

  @HttpCode(HttpStatus.OK)
  @Delete(':id')
  async remove(@Param('id') id: string) {
    return this.subjectsService.remove(id);
  }
}
