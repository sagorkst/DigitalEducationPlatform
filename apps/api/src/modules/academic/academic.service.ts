import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';

type Data = Record<string, unknown>;
@Injectable()
export class AcademicService {
  constructor(private readonly prisma: PrismaService) {}
  // Cast only the new Prisma delegates so the API source remains type-checkable
  // until the generated Prisma client is refreshed after applying this schema.
  private get db(): any { return this.prisma as any; }
  private text(body: Data, key: string, required = false): string | undefined {
    const value = body[key];
    if (value === undefined || value === null || value === '') {
      if (required) throw new BadRequestException(key + ' is required.');
      return undefined;
    }
    if (typeof value !== 'string' || !value.trim()) throw new BadRequestException(key + ' must be a non-empty string.');
    return value.trim();
  }
  private int(body: Data, key: string, fallback = 0): number {
    const value = body[key];
    if (value === undefined) return fallback;
    const number = Number(value);
    if (!Number.isInteger(number) || number < 0) throw new BadRequestException(key + ' must be a non-negative integer.');
    return number;
  }
  private bool(body: Data, key: string, fallback = true): boolean {
    const value = body[key];
    if (value === undefined) return fallback;
    if (typeof value !== 'boolean') throw new BadRequestException(key + ' must be boolean.');
    return value;
  }
  private async exists(delegate: any, id: string, label: string) {
    const row = await delegate.findUnique({ where: { id } });
    if (!row) throw new NotFoundException(label + ' not found.');
    return row;
  }
  async listClasses(search?: string) {
    const rows = await this.db.academicClass.findMany({ where: { isActive: true, ...(search?.trim() ? { name: { contains: search.trim(), mode: 'insensitive' } } : {}) }, orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }], include: { _count: { select: { classSubjects: true, enrollments: true } } } });
    return { success: true, data: rows };
  }
  async getClass(id: string) {
    const row = await this.db.academicClass.findFirst({
      where: { id, isActive: true },
      include: {
        classSubjects: {
          where: { isActive: true },
          orderBy: { sortOrder: 'asc' },
          include: {
            subject: true,
            chapters: {
              where: { isActive: true },
              orderBy: { sortOrder: 'asc' },
              include: {
                lessons: {
                  where: { isPublished: true },
                  orderBy: { sortOrder: 'asc' },
                  include: {
                    materials: {
                      where: { isPublished: true },
                      orderBy: { sortOrder: 'asc' },
                    },
                  },
                },
              },
            },
          },
        },
      },
    });
    if (!row) throw new NotFoundException('Academic class not found.');
    return { success: true, data: row };
  }
  async createClass(body: Data) {
    const name = this.text(body, 'name', true)!;
    const code = (this.text(body, 'code') ?? name.toLowerCase().replace(/[^\\p{L}\\p{N}]+/gu, '-').replace(/^-|-$/g, '')).toUpperCase();
    if (!code) throw new BadRequestException('Class code is required when it cannot be generated from the class name.');
    try {
      const data = await this.db.academicClass.create({ data: { name, code, level: this.text(body, 'level'), description: this.text(body, 'description'), sortOrder: this.int(body, 'sortOrder'), isActive: this.bool(body, 'isActive') } });
      return { success: true, data };
    } catch (error) { if ((error as any)?.code === 'P2002') throw new ConflictException('Class name/code already exists.'); throw error; }
  }
  async updateClass(id: string, body: Data) {
    await this.exists(this.db.academicClass, id, 'Academic class');
    const data: Data = {};
    for (const key of ['name', 'code', 'level', 'description'] as const) { const value = this.text(body, key); if (value !== undefined) data[key] = key === 'code' ? value.toUpperCase() : value; }
    if (body.sortOrder !== undefined) data.sortOrder = this.int(body, 'sortOrder');
    if (body.isActive !== undefined) data.isActive = this.bool(body, 'isActive');
    if (!Object.keys(data).length) throw new BadRequestException('No valid fields supplied.');
    try { return { success: true, data: await this.db.academicClass.update({ where: { id }, data }) }; }
    catch (error) { if ((error as any)?.code === 'P2002') throw new ConflictException('Class code already exists.'); throw error; }
  }
  async deleteClass(id: string) { await this.exists(this.db.academicClass, id, 'Academic class'); await this.db.academicClass.delete({ where: { id } }); return { success: true }; }
  async listSessions() { return { success: true, data: await this.db.academicSession.findMany({ where: { isActive: true }, orderBy: [{ isCurrent: 'desc' }, { name: 'desc' }] }) }; }
  async createSession(body: Data) {
    const name = this.text(body, 'name', true)!;
    const startsAt = this.text(body, 'startsAt');
    const endsAt = this.text(body, 'endsAt');
    if (startsAt && endsAt && new Date(startsAt) > new Date(endsAt)) throw new BadRequestException('Session end must not be before start.');
    const data = await this.db.$transaction(async (tx: any) => {
      if (body.isCurrent === true) await tx.academicSession.updateMany({ data: { isCurrent: false } });
      return tx.academicSession.create({ data: { name, startsAt: startsAt ? new Date(startsAt) : null, endsAt: endsAt ? new Date(endsAt) : null, isCurrent: this.bool(body, 'isCurrent', false), isActive: this.bool(body, 'isActive') } });
    });
    return { success: true, data };
  }
  async updateSession(id: string, body: Data) {
    await this.exists(this.db.academicSession, id, 'Academic session');
    const data: Data = {};
    const name = this.text(body, 'name'); if (name !== undefined) data.name = name;
    for (const key of ['startsAt', 'endsAt'] as const) if (body[key] !== undefined) { const value = this.text(body, key); data[key] = value ? new Date(value) : null; }
    if (body.isActive !== undefined) data.isActive = this.bool(body, 'isActive');
    if (body.isCurrent !== undefined) data.isCurrent = this.bool(body, 'isCurrent', false);
    if (!Object.keys(data).length) throw new BadRequestException('No valid fields supplied.');
    const result = await this.db.$transaction(async (tx: any) => {
      if (data.isCurrent === true) await tx.academicSession.updateMany({ where: { NOT: { id } }, data: { isCurrent: false } });
      return tx.academicSession.update({ where: { id }, data });
    });
    return { success: true, data: result };
  }
  async deleteSession(id: string) { await this.exists(this.db.academicSession, id, 'Academic session'); await this.db.academicSession.delete({ where: { id } }); return { success: true }; }
  async listSubjects() { return { success: true, data: await this.db.subject.findMany({ orderBy: { name: 'asc' } }) }; }
  async classSubjects(classId: string) {
    await this.exists(this.db.academicClass, classId, 'Academic class');
    return { success: true, data: await this.db.classSubject.findMany({ where: { classId }, include: { subject: true, chapters: { orderBy: { sortOrder: 'asc' }, include: { _count: { select: { lessons: true } } } } }, orderBy: { sortOrder: 'asc' } }) };
  }
  async assignSubject(body: Data) {
    const classId = this.text(body, 'classId', true)!; const subjectId = this.text(body, 'subjectId', true)!;
    await this.exists(this.db.academicClass, classId, 'Academic class'); await this.exists(this.db.subject, subjectId, 'Subject');
    try { const data = await this.db.classSubject.create({ data: { classId, subjectId, sortOrder: this.int(body, 'sortOrder'), isActive: this.bool(body, 'isActive') }, include: { subject: true } }); return { success: true, data }; }
    catch (error) { if ((error as any)?.code === 'P2002') throw new ConflictException('Subject is already assigned to this class.'); throw error; }
  }
  async removeSubject(id: string) { await this.exists(this.db.classSubject, id, 'Class subject'); await this.db.classSubject.delete({ where: { id } }); return { success: true }; }
  async listChapters(classSubjectId: string) {
    await this.exists(this.db.classSubject, classSubjectId, 'Class subject');
    return { success: true, data: await this.db.chapter.findMany({ where: { classSubjectId }, orderBy: { sortOrder: 'asc' }, include: { _count: { select: { lessons: true } } } }) };
  }
  async createChapter(body: Data) {
    const classSubjectId = this.text(body, 'classSubjectId', true)!; await this.exists(this.db.classSubject, classSubjectId, 'Class subject');
    return { success: true, data: await this.db.chapter.create({ data: { classSubjectId, name: this.text(body, 'name', true), description: this.text(body, 'description'), sortOrder: this.int(body, 'sortOrder'), isActive: this.bool(body, 'isActive') } }) };
  }
  async updateChapter(id: string, body: Data) {
    await this.exists(this.db.chapter, id, 'Chapter'); const data: Data = {};
    for (const key of ['name', 'description'] as const) { const v = this.text(body, key); if (v !== undefined) data[key] = v; }
    if (body.sortOrder !== undefined) data.sortOrder = this.int(body, 'sortOrder'); if (body.isActive !== undefined) data.isActive = this.bool(body, 'isActive');
    if (!Object.keys(data).length) throw new BadRequestException('No valid fields supplied.');
    return { success: true, data: await this.db.chapter.update({ where: { id }, data }) };
  }
  async deleteChapter(id: string) { await this.exists(this.db.chapter, id, 'Chapter'); await this.db.chapter.delete({ where: { id } }); return { success: true }; }
  async listLessons(chapterId: string) {
    await this.exists(this.db.chapter, chapterId, 'Chapter');
    return { success: true, data: await this.db.lesson.findMany({ where: { chapterId }, orderBy: { sortOrder: 'asc' }, include: { materials: { orderBy: { sortOrder: 'asc' } } } }) };
  }
  async createLesson(body: Data) {
    const chapterId = this.text(body, 'chapterId', true)!; await this.exists(this.db.chapter, chapterId, 'Chapter');
    const durationMin = body.durationMin === undefined ? undefined : this.int(body, 'durationMin');
    return { success: true, data: await this.db.lesson.create({ data: { chapterId, title: this.text(body, 'title', true), description: this.text(body, 'description'), content: this.text(body, 'content'), videoUrl: this.text(body, 'videoUrl'), durationMin, sortOrder: this.int(body, 'sortOrder'), isPublished: this.bool(body, 'isPublished', false) } }) };
  }
  async updateLesson(id: string, body: Data) {
    await this.exists(this.db.lesson, id, 'Lesson'); const data: Data = {};
    for (const key of ['title', 'description', 'content', 'videoUrl'] as const) { if (body[key] !== undefined) data[key] = body[key] === '' ? null : this.text(body, key); }
    if (body.durationMin !== undefined) data.durationMin = this.int(body, 'durationMin');
    if (body.sortOrder !== undefined) data.sortOrder = this.int(body, 'sortOrder');
    if (body.isPublished !== undefined) data.isPublished = this.bool(body, 'isPublished', false);
    if (!Object.keys(data).length) throw new BadRequestException('No valid fields supplied.');
    return { success: true, data: await this.db.lesson.update({ where: { id }, data }) };
  }
  async deleteLesson(id: string) { await this.exists(this.db.lesson, id, 'Lesson'); await this.db.lesson.delete({ where: { id } }); return { success: true }; }
  async listMaterials(lessonId: string) { await this.exists(this.db.lesson, lessonId, 'Lesson'); return { success: true, data: await this.db.studyMaterial.findMany({ where: { lessonId }, orderBy: { sortOrder: 'asc' } }) }; }
  async createMaterial(body: Data) {
    const lessonId = this.text(body, 'lessonId', true)!; await this.exists(this.db.lesson, lessonId, 'Lesson');
    return { success: true, data: await this.db.studyMaterial.create({ data: { lessonId, title: this.text(body, 'title', true), materialType: this.text(body, 'materialType', true), fileUrl: this.text(body, 'fileUrl', true), description: this.text(body, 'description'), sortOrder: this.int(body, 'sortOrder'), isPublished: this.bool(body, 'isPublished', false) } }) };
  }
  async updateMaterial(id: string, body: Data) {
    await this.exists(this.db.studyMaterial, id, 'Study material'); const data: Data = {};
    for (const key of ['title', 'materialType', 'fileUrl', 'description'] as const) { if (body[key] !== undefined) data[key] = this.text(body, key); }
    if (body.sortOrder !== undefined) data.sortOrder = this.int(body, 'sortOrder');
    if (body.isPublished !== undefined) data.isPublished = this.bool(body, 'isPublished', false);
    if (!Object.keys(data).length) throw new BadRequestException('No valid fields supplied.');
    return { success: true, data: await this.db.studyMaterial.update({ where: { id }, data }) };
  }
  async deleteMaterial(id: string) { await this.exists(this.db.studyMaterial, id, 'Study material'); await this.db.studyMaterial.delete({ where: { id } }); return { success: true }; }
  async myEnrollment(userId: string) { return { success: true, data: await this.db.studentEnrollment.findMany({ where: { userId, status: 'ACTIVE' }, include: { academicClass: true, session: true } }) }; }
  async enroll(userId: string, body: Data) {
    const classId = this.text(body, 'classId', true)!; const sessionId = this.text(body, 'sessionId', true)!;
    await this.exists(this.db.academicClass, classId, 'Academic class'); await this.exists(this.db.academicSession, sessionId, 'Academic session');
    const data = await this.db.studentEnrollment.upsert({ where: { userId_sessionId: { userId, sessionId } }, update: { classId, status: 'ACTIVE' }, create: { userId, classId, sessionId }, include: { academicClass: true, session: true } });
    return { success: true, data };
  }
  async myProgress(userId: string) { return { success: true, data: await this.db.lessonProgress.findMany({ where: { userId }, include: { lesson: { include: { chapter: true } } }, orderBy: { updatedAt: 'desc' } }) }; }
  async setProgress(userId: string, lessonId: string, completed: boolean) {
    await this.exists(this.db.lesson, lessonId, 'Lesson');
    const data = await this.db.lessonProgress.upsert({ where: { userId_lessonId: { userId, lessonId } }, update: { completedAt: completed ? new Date() : null }, create: { userId, lessonId, completedAt: completed ? new Date() : null } });
    return { success: true, data };
  }
}
