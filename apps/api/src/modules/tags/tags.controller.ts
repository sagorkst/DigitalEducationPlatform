import {
  Controller,
  UseGuards,
  Get,
  Post,
  Patch,
  Put,
  Delete,
  Param,
  Query,
  Body,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PermissionsGuard } from '../rbac/permissions.guard';
import { RequirePermissions } from '../rbac/permissions.decorator';

import { TagsService } from './tags.service';

@Controller('tags')
@UseGuards(JwtAuthGuard, PermissionsGuard)
@RequirePermissions('content.manage')
export class TagsController {
  constructor(private readonly tagsService: TagsService) {}

  @Post()
  create(@Body() body: { name: string; slug?: string }) {
    return this.tagsService.create(body);
  }

  @Get()
  findAll(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('search') search?: string,
  ) {
    return this.tagsService.findAll({
      page: Number(page) || 1,
      limit: Number(limit) || 20,
      search,
    });
  }

  @Get('questions/search')
  searchQuestions(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('search') search?: string,
    @Query('tag') tag?: string,
    @Query('tagIds') tagIds?: string,
    @Query('matchMode') matchMode?: string,
  ) {
    return this.tagsService.searchQuestions({
      page: Number(page) || 1,
      limit: Number(limit) || 20,
      search,
      tag,
      tagIds,
      matchMode,
    });
  }

  @Put('questions/:questionId')
  assignToQuestion(
    @Param('questionId') questionId: string,
    @Body() body: { tagIds: string[] },
  ) {
    return this.tagsService.assignToQuestion(questionId, body);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.tagsService.findOne(id);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() body: { name?: string; slug?: string },
  ) {
    return this.tagsService.update(id, body);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.tagsService.remove(id);
  }
}
