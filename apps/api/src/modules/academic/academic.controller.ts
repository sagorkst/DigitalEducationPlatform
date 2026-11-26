import {
  Body, Controller, Delete, Get, Param, Patch, Post, Query,
  Req, UseGuards,
} from '@nestjs/common';
import { Request } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PermissionsGuard } from '../rbac/permissions.guard';
import { RequirePermissions } from '../rbac/permissions.decorator';
import { AcademicService } from './academic.service';

type AuthenticatedRequest = Request & { user?: { id: string } };

@Controller('academic')
export class AcademicController {
  constructor(private readonly service: AcademicService) {}

  @Get('classes') listClasses(@Query('search') search?: string) {
    return this.service.listClasses(search);
  }
  @Get('sessions') listSessions() { return this.service.listSessions(); }
  @Get('subjects') listSubjects() { return this.service.listSubjects(); }
  @Get('classes/:id') getClass(@Param('id') id: string) { return this.service.getClass(id); }
  @Get('classes/:id/subjects') classSubjects(@Param('id') id: string) { return this.service.classSubjects(id); }
  @Get('class-subjects/:id/chapters') chapters(@Param('id') id: string) { return this.service.listChapters(id); }
  @Get('chapters/:id/lessons') lessons(@Param('id') id: string) { return this.service.listLessons(id); }
  @Get('lessons/:id/materials') materials(@Param('id') id: string) { return this.service.listMaterials(id); }

  @Post('classes') @UseGuards(JwtAuthGuard, PermissionsGuard) @RequirePermissions('academic.manage')
  createClass(@Body() body: Record<string, unknown>) { return this.service.createClass(body); }
  @Patch('classes/:id') @UseGuards(JwtAuthGuard, PermissionsGuard) @RequirePermissions('academic.manage')
  updateClass(@Param('id') id: string, @Body() body: Record<string, unknown>) { return this.service.updateClass(id, body); }
  @Delete('classes/:id') @UseGuards(JwtAuthGuard, PermissionsGuard) @RequirePermissions('academic.manage')
  deleteClass(@Param('id') id: string) { return this.service.deleteClass(id); }

  @Post('sessions') @UseGuards(JwtAuthGuard, PermissionsGuard) @RequirePermissions('academic.manage')
  createSession(@Body() body: Record<string, unknown>) { return this.service.createSession(body); }
  @Patch('sessions/:id') @UseGuards(JwtAuthGuard, PermissionsGuard) @RequirePermissions('academic.manage')
  updateSession(@Param('id') id: string, @Body() body: Record<string, unknown>) { return this.service.updateSession(id, body); }
  @Delete('sessions/:id') @UseGuards(JwtAuthGuard, PermissionsGuard) @RequirePermissions('academic.manage')
  deleteSession(@Param('id') id: string) { return this.service.deleteSession(id); }

  @Post('class-subjects') @UseGuards(JwtAuthGuard, PermissionsGuard) @RequirePermissions('academic.manage')
  assignSubject(@Body() body: Record<string, unknown>) { return this.service.assignSubject(body); }
  @Delete('class-subjects/:id') @UseGuards(JwtAuthGuard, PermissionsGuard) @RequirePermissions('academic.manage')
  removeSubject(@Param('id') id: string) { return this.service.removeSubject(id); }

  @Post('chapters') @UseGuards(JwtAuthGuard, PermissionsGuard) @RequirePermissions('academic.manage')
  createChapter(@Body() body: Record<string, unknown>) { return this.service.createChapter(body); }
  @Patch('chapters/:id') @UseGuards(JwtAuthGuard, PermissionsGuard) @RequirePermissions('academic.manage')
  updateChapter(@Param('id') id: string, @Body() body: Record<string, unknown>) { return this.service.updateChapter(id, body); }
  @Delete('chapters/:id') @UseGuards(JwtAuthGuard, PermissionsGuard) @RequirePermissions('academic.manage')
  deleteChapter(@Param('id') id: string) { return this.service.deleteChapter(id); }

  @Post('lessons') @UseGuards(JwtAuthGuard, PermissionsGuard) @RequirePermissions('academic.manage')
  createLesson(@Body() body: Record<string, unknown>) { return this.service.createLesson(body); }
  @Patch('lessons/:id') @UseGuards(JwtAuthGuard, PermissionsGuard) @RequirePermissions('academic.manage')
  updateLesson(@Param('id') id: string, @Body() body: Record<string, unknown>) { return this.service.updateLesson(id, body); }
  @Delete('lessons/:id') @UseGuards(JwtAuthGuard, PermissionsGuard) @RequirePermissions('academic.manage')
  deleteLesson(@Param('id') id: string) { return this.service.deleteLesson(id); }

  @Post('materials') @UseGuards(JwtAuthGuard, PermissionsGuard) @RequirePermissions('academic.manage')
  createMaterial(@Body() body: Record<string, unknown>) { return this.service.createMaterial(body); }
  @Patch('materials/:id') @UseGuards(JwtAuthGuard, PermissionsGuard) @RequirePermissions('academic.manage')
  updateMaterial(@Param('id') id: string, @Body() body: Record<string, unknown>) { return this.service.updateMaterial(id, body); }
  @Delete('materials/:id') @UseGuards(JwtAuthGuard, PermissionsGuard) @RequirePermissions('academic.manage')
  deleteMaterial(@Param('id') id: string) { return this.service.deleteMaterial(id); }

  @Get('my-enrollment') @UseGuards(JwtAuthGuard)
  myEnrollment(@Req() request: AuthenticatedRequest) { return this.service.myEnrollment(request.user!.id); }
  @Post('enroll') @UseGuards(JwtAuthGuard)
  enroll(@Req() request: AuthenticatedRequest, @Body() body: Record<string, unknown>) { return this.service.enroll(request.user!.id, body); }
  @Get('my-progress') @UseGuards(JwtAuthGuard)
  myProgress(@Req() request: AuthenticatedRequest) { return this.service.myProgress(request.user!.id); }
  @Post('lessons/:id/progress') @UseGuards(JwtAuthGuard)
  setProgress(@Req() request: AuthenticatedRequest, @Param('id') id: string, @Body() body: { completed?: boolean }) { return this.service.setProgress(request.user!.id, id, body.completed !== false); }
}
