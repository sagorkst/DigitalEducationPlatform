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
  DefaultValuePipe,
  ParseIntPipe,
} from '@nestjs/common';

import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PermissionsGuard } from '../rbac/permissions.guard';
import { RequirePermissions } from '../rbac/permissions.decorator';

import { ExamsService } from './exams.service';
import { CreateExamDto } from './dto/create-exam.dto';
import { UpdateExamDto } from './dto/update-exam.dto';

@Controller('exams')
export class ExamsController {
  constructor(
    private readonly examsService: ExamsService,
  ) {}

  @Post()
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermissions('content.manage')
  create(@Body() dto: CreateExamDto) {
    return this.examsService.create(dto);
  }

  @Get()
  findAll(
    @Query('search') search?: string,

    @Query(
      'institutionId',
      new ParseUUIDPipe({ optional: true }),
    )
    institutionId?: string,

    @Query(
      'postId',
      new ParseUUIDPipe({ optional: true }),
    )
    postId?: string,

    @Query('examYear', new ParseIntPipe({ optional: true }))
    examYear?: number,

    @Query('examType') examType?: string,

    @Query('page', new DefaultValuePipe(1), ParseIntPipe)
    page?: number,

    @Query('limit', new DefaultValuePipe(20), ParseIntPipe)
    limit?: number,
  ) {
    return this.examsService.findAll({
      search,
      institutionId,
      postId,
      examYear,
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
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermissions('content.manage')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateExamDto,
  ) {
    return this.examsService.update(id, dto);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermissions('content.manage')
  remove(
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.examsService.remove(id);
  }
}