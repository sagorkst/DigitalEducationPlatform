
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

import { PostsService } from './posts.service';
import { CreatePostDto } from './dto/create-post.dto';
import { UpdatePostDto } from './dto/update-post.dto';

@Controller('posts')
export class PostsController {
  constructor(
    private readonly postsService: PostsService,
  ) {}

  @Post()
  create(@Body() dto: CreatePostDto) {
    return this.postsService.create(dto);
  }

  @Get()
  findAll(
    @Query('search') search?: string,
    @Query('page', new DefaultValuePipe(1), ParseIntPipe)
    page?: number,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe)
    limit?: number,
  ) {
    return this.postsService.findAll({
      search,
      page,
      limit,
    });
  }

  @Get(':id')
  findOne(
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.postsService.findOne(id);
  }

  @Put(':id')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdatePostDto,
  ) {
    return this.postsService.update(id, dto);
  }

  @Delete(':id')
  remove(
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.postsService.remove(id);
  }
}
