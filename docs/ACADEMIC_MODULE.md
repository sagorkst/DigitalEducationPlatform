# Academic Module

## Scope
This module reuses the existing `Subject` table and adds class/session mapping, chapters, lessons, study materials, student enrollment, and per-lesson progress.

## Data model
- AcademicClass -> ClassSubject -> existing Subject
- ClassSubject -> Chapter -> Lesson -> StudyMaterial
- AcademicSession -> StudentEnrollment <- User
- User -> LessonProgress <- Lesson

## Setup
From the repository root:
```powershell
npm install
npm run db:generate
npm run db:migrate:deploy
npm run db:seed --workspace=@shikhasetu/api
```
The `.env` file must contain `DATABASE_URL`. Prisma client generation is required after pulling because the generated client is not committed as part of this feature.

## Main routes
- Public read: `GET /api/academic/classes`, `GET /api/academic/classes/:id`
- Admin write (JWT + `academic.manage`): classes, sessions, class-subject mappings, chapters, lessons, materials
- Student JWT: `GET /api/academic/sessions`, `POST /api/academic/enroll`, `GET /api/academic/my-enrollment`, `GET /api/academic/my-progress`, `POST /api/academic/lessons/:id/progress`

## UI
- Admin: `/admin/academic`
- Public academic catalogue: `/academic`
- Student enrollment/progress: `/dashboard/academic`

## Known limitations
- Study material currently stores a hosted URL; a managed upload/storage provider is not integrated.
- Lesson progress API is present; a complete in-lesson progress experience and teacher/guardian reporting still need product-level decisions.
- Runtime build, migration, and browser checks must be run against the project's actual local environment before merging.
