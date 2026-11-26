-- Academic management foundation. Existing Subject records are reused.
CREATE TABLE "AcademicClass" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "name" TEXT NOT NULL,
  "code" TEXT NOT NULL,
  "level" TEXT,
  "description" TEXT,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "AcademicClass_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "AcademicClass_code_key" ON "AcademicClass"("code");
CREATE INDEX "AcademicClass_isActive_sortOrder_idx" ON "AcademicClass"("isActive","sortOrder");
CREATE INDEX "AcademicClass_name_idx" ON "AcademicClass"("name");
CREATE TABLE "AcademicSession" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "name" TEXT NOT NULL,
  "startsAt" TIMESTAMP(3),
  "endsAt" TIMESTAMP(3),
  "isCurrent" BOOLEAN NOT NULL DEFAULT false,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "AcademicSession_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "AcademicSession_name_key" ON "AcademicSession"("name");
CREATE INDEX "AcademicSession_isActive_isCurrent_idx" ON "AcademicSession"("isActive","isCurrent");
CREATE TABLE "ClassSubject" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "classId" UUID NOT NULL,
  "subjectId" UUID NOT NULL,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ClassSubject_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "ClassSubject_classId_subjectId_key" ON "ClassSubject"("classId","subjectId");
CREATE INDEX "ClassSubject_classId_isActive_sortOrder_idx" ON "ClassSubject"("classId","isActive","sortOrder");
CREATE INDEX "ClassSubject_subjectId_idx" ON "ClassSubject"("subjectId");
CREATE TABLE "Chapter" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "classSubjectId" UUID NOT NULL,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Chapter_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "Chapter_classSubjectId_isActive_sortOrder_idx" ON "Chapter"("classSubjectId","isActive","sortOrder");
CREATE TABLE "Lesson" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "chapterId" UUID NOT NULL,
  "title" TEXT NOT NULL,
  "description" TEXT,
  "content" TEXT,
  "videoUrl" TEXT,
  "durationMin" INTEGER,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "isPublished" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Lesson_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "Lesson_chapterId_isPublished_sortOrder_idx" ON "Lesson"("chapterId","isPublished","sortOrder");
CREATE TABLE "StudyMaterial" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "lessonId" UUID NOT NULL,
  "title" TEXT NOT NULL,
  "materialType" TEXT NOT NULL,
  "fileUrl" TEXT NOT NULL,
  "description" TEXT,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "isPublished" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "StudyMaterial_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "StudyMaterial_lessonId_isPublished_sortOrder_idx" ON "StudyMaterial"("lessonId","isPublished","sortOrder");
CREATE TABLE "StudentEnrollment" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "userId" UUID NOT NULL,
  "classId" UUID NOT NULL,
  "sessionId" UUID NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'ACTIVE',
  "enrolledAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "StudentEnrollment_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "StudentEnrollment_userId_sessionId_key" ON "StudentEnrollment"("userId","sessionId");
CREATE INDEX "StudentEnrollment_classId_sessionId_status_idx" ON "StudentEnrollment"("classId","sessionId","status");
CREATE INDEX "StudentEnrollment_userId_status_idx" ON "StudentEnrollment"("userId","status");
CREATE TABLE "LessonProgress" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "userId" UUID NOT NULL,
  "lessonId" UUID NOT NULL,
  "completedAt" TIMESTAMP(3),
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "LessonProgress_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "LessonProgress_userId_lessonId_key" ON "LessonProgress"("userId","lessonId");
CREATE INDEX "LessonProgress_userId_completedAt_idx" ON "LessonProgress"("userId","completedAt");
ALTER TABLE "ClassSubject" ADD CONSTRAINT "ClassSubject_classId_fkey" FOREIGN KEY ("classId") REFERENCES "AcademicClass"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ClassSubject" ADD CONSTRAINT "ClassSubject_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "Subject"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Chapter" ADD CONSTRAINT "Chapter_classSubjectId_fkey" FOREIGN KEY ("classSubjectId") REFERENCES "ClassSubject"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Lesson" ADD CONSTRAINT "Lesson_chapterId_fkey" FOREIGN KEY ("chapterId") REFERENCES "Chapter"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "StudyMaterial" ADD CONSTRAINT "StudyMaterial_lessonId_fkey" FOREIGN KEY ("lessonId") REFERENCES "Lesson"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "StudentEnrollment" ADD CONSTRAINT "StudentEnrollment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "StudentEnrollment" ADD CONSTRAINT "StudentEnrollment_classId_fkey" FOREIGN KEY ("classId") REFERENCES "AcademicClass"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "StudentEnrollment" ADD CONSTRAINT "StudentEnrollment_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "AcademicSession"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "LessonProgress" ADD CONSTRAINT "LessonProgress_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "LessonProgress" ADD CONSTRAINT "LessonProgress_lessonId_fkey" FOREIGN KEY ("lessonId") REFERENCES "Lesson"("id") ON DELETE CASCADE ON UPDATE CASCADE;
