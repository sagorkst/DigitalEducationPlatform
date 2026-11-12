# Shikhasetu Public Question Bank Patch

## Scope

This patch adds a public, read-only Question Bank while keeping the existing administrative Question Bank at `/dashboard/question-bank`.

- Public routes: `/question-bank`, `/question-bank/[id]`, `/question-bank/subject/[id]`, and `/question-bank/topic/[id]`
- Public API: `/api/public/questions`, `/api/public/questions/:id`, `/api/public/subjects`, `/api/public/filters`
- Existing Admin API routes under `/api/questions` are not made public and retain their JWT/RBAC guards.
- No Prisma schema change or database migration is required.

## Apply on Windows

From `C:\Projects\DigitalEducationPlatform`:

```powershell
Expand-Archive -LiteralPath .\shikhasetu-public-qbank-patch.zip -DestinationPath .\_shikhasetu-public-qbank-patch -Force
Copy-Item -Path .\_shikhasetu-public-qbank-patch\apps -Destination . -Recurse -Force
```

The archive contains the `apps` directory tree and this README. It does not contain `.env`, credentials, `node_modules`, generated Prisma client output, or database data.

## Required environment

Keep the existing `API_BASE_URL` configuration as used by the web app. Set this public site URL in the web deployment environment so the sitemap can emit absolute URLs:

```env
NEXT_PUBLIC_SITE_URL=https://your-production-domain
```

Do not copy secrets into the patch.

## Install, generate, build and test

Run from the repository root:

```powershell
npm ci
npx prisma generate --schema prisma/schema.prisma
npm run typecheck --workspace=@shikhasetu/api
npm run build --workspace=@shikhasetu/api
npm run build --workspace=web
npm run lint --workspace=web
npm run test:public-questions --workspace=@shikhasetu/api
```

The integration security test requires a separately provisioned test database named exactly `shikhasetu_test`, `TEST_DATABASE_URL`, `CORS_ORIGINS`, and the normal test JWT configuration in the local environment. It has a safety check that rejects a database with any other name. Never point it at production.

```powershell
npm run test:questions-security --workspace=@shikhasetu/api
```

The integration test checks anonymous public reads, rejects anonymous and ordinary-user access to Admin Question APIs and supporting management APIs, and verifies that the Admin Question API remains protected.

## Behavior and security

- Public list/detail queries hard-code `status = PUBLISHED` and `deletedAt = null`.
- Draft, Hidden, Archived, and soft-deleted questions are not returned.
- Linked inactive subjects/topics are excluded from public question listing and detail pages.
- List responses omit answer, explanation, history, audit and internal admin fields.
- Detail responses expose answer/explanation as public learning content; the UI initially hides them behind “উত্তর দেখুন”.
- Search, filters and pagination are validated server-side; page size is capped at 100.\n- Subject/topic browsing pages and dynamic question metadata are included. Sitemap generation is capped at 10,000 question URLs per generated sitemap pass; adjust/split it if the published bank grows beyond that size.
- The admin page is restored at `/dashboard/question-bank`, gated in the UI by `content.manage`.
- The all-question Admin read endpoints now require `content.manage` rather than the broad `questions.read` permission, so normal accounts cannot retrieve unpublished content through the old endpoint.
- Related admin APIs for imports, duplicates, occurrences, reviews, tags, analytics and master-data mutations now enforce JWT/RBAC permissions. Public metadata GETs for institutions, exams and posts remain read-only.
- Existing import, OCR, history, trash, restore and question CRUD UI source is retained in the moved admin component.

## Verification status

A TypeScript syntax/transpile pass was run over all `.ts` and `.tsx` files in the extracted project after patch assembly. It reported no syntax diagnostics. Full API/web builds and database-backed tests were **not executed** in this environment because the uploaded archive does not include `node_modules`, generated Prisma client output, or a configured test database. Do not treat the syntax pass as a successful production build.

## Patch contents

The patch contains 40 project files:
- 24 API implementation/config/security/test files
- 4 Next.js public API proxy routes
- 7 Next.js page/SEO route files
- 5 frontend components
- 1 README

No schema migration is included because the existing schema already contains the required Question, QuestionOption, Subject, Topic, QuestionOccurrence and repeat-group fields.
