
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

import { TopicsService } from './topics.service';
import { CreateTopicDto } from './dto/topics/create-topic.dto';
import { UpdateTopicDto } from './dto/topics/update-topic.dto';

@Controller('topics')
export class TopicsController {
  constructor(private readonly topicsService: TopicsService) {}

  // CREATE TOPIC
  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(@Body() dto: CreateTopicDto) {
    return this.topicsService.create(dto);
  }

  // GET ALL TOPICS
  @Get()
  async findAll(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('search') search?: string,
    @Query('subjectId') subjectId?: string,
    @Query('parentId') parentId?: string,
    @Query('isActive') isActive?: string,
  ) {
    return this.topicsService.findAll({
      page,
      limit,
      search,
      subjectId,
      parentId,
      isActive,
    });
  }

  // GET TOPIC DETAILS
  @Get(':id')
  async findOne(@Param('id') id: string) {
    return this.topicsService.findOne(id);
  }

  // UPDATE TOPIC
  @Put(':id')
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateTopicDto,
  ) {
    return this.topicsService.update(id, dto);
  }

  // DELETE TOPIC
  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  async remove(@Param('id') id: string) {
    return this.topicsService.remove(id);
  }
}
