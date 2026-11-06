import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  ParseUUIDPipe,
  DefaultValuePipe,
  ParseIntPipe,
} from '@nestjs/common';

import { ExamsService } from './exams.service';
import { CreateExamDto } from './dto/create-exam.dto';
import { UpdateExamDto } from './dto/update-exam.dto';

@Controller('exams')
export class ExamsController {
  constructor(
    private readonly examsService: ExamsService,
  ) {}

  @Post()
  create(@Body() dto: CreateExamDto) {
    return this.examsService.create(dto);
  }

  @Get()
  findAll(
    @Query('search') search?: string,
    @Query('institutionId') institutionId?: string,
    @Query('examType') examType?: string,
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page?: number,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit?: number,
  ) {
    return this.examsService.findAll({
      search,
      institutionId,
      examType,
      page,
      limit,
    });
  }

  @Get(':id')
  findOne(
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.examsService.findOne(id);
  }

  @Put(':id')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateExamDto,
  ) {
    return this.examsService.update(id, dto);
  }

  @Delete(':id')
  remove(
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.examsService.remove(id);
  }
}