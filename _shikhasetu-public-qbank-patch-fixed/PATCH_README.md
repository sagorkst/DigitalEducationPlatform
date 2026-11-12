# Shikhasetu Public Question Bank — Corrected Patch

## উদ্দেশ্য

এই patch-এর লক্ষ্য হলো Shikhasetu-তে লগইন ছাড়াই সকল দর্শনার্থীর জন্য Question Bank পড়ার ব্যবস্থা করা এবং Admin Question Bank-কে আলাদা, অনুমতিনির্ভর ব্যবস্থাপনায় রাখা।

## Public routes

- `/question-bank` — Public Question Bank landing, listing, search, combined filters, subject list, pagination
- `/question-bank/[id]` — প্রশ্নের বিস্তারিত, options, উত্তর দেখুন/লুকান, explanation, exam occurrence, previous/next, related repeated questions
- `/question-bank/subject/[id]` — বিষয়ভিত্তিক প্রশ্ন
- `/question-bank/topic/[id]` — topic/chapter ভিত্তিক প্রশ্ন

## Public API routes

- `GET /api/public/questions`
- `GET /api/public/questions/:id`
- `GET /api/public/subjects`
- `GET /api/public/topics`
- `GET /api/public/filters`

এগুলো Next.js BFF proxy দিয়ে NestJS-এর `/api/public/...` endpoint-এ যায়। Public API-তে কোনো login token পাঠানো হয় না।

## Privacy and security rules

- Public list ও detail query-তে সার্ভার-সাইডে `status = PUBLISHED` এবং `deletedAt = null` বাধ্যতামূলক।
- Draft, Hidden, Archived ও soft-deleted প্রশ্ন public response-এ আসবে না।
- inactive Subject/Topic-এর সঙ্গে যুক্ত প্রশ্নও বাদ যাবে।
- Listing response-এ correct answer বা explanation নেই।
- Detail response-এ answer ও explanation public learning content হিসেবে ফেরত আসে; UI-তে শুরুতে লুকানো থাকে এবং “উত্তর দেখুন” চাপলে প্রকাশ পায়। এটি UI concealment, API থেকে গোপন রাখা নয়।
- Admin Question API (`/api/questions`) JWT + RBAC guard-এর অধীনে থাকবে।
- Imports, OCR, duplicates, occurrences, reviews, tags, analytics এবং master-data mutation endpoints-এ authentication/permission guard রয়েছে।
- Admin UI route: `/dashboard/question-bank`; page UI gate-এর পাশাপাশি backend API-তেও permission enforcement আছে।
- Admin link/header-এ permission state না থাকলে management link দেখানো হবে না।
- External source URL কেবল `http` বা `https` হলে clickable হবে।

## Filters

Search, subject, topic, institution, exam name + exact exam year, post, year range, question type, difficulty, repeated status এবং pagination একসঙ্গে ব্যবহার করা যায়। একই exam name একাধিক বছরে থাকলে exam year আলাদা করে filter করা হয়।

## SEO

- Public question detail-এর dynamic metadata ও canonical URL
- Subject/topic metadata
- Sitemap এবং robots route
- `/dashboard/`, `/api/`, login ও register paths robots disallow; dashboard metadata noindex
- Sitemap-এ প্রতি build/pass-এ সর্বোচ্চ 10,000 question URL অন্তর্ভুক্ত করা হয়; এর বেশি হলে sitemap chunking/indexing আলাদা করে যোগ করতে হবে।

## Database

এই patch-এ Prisma schema পরিবর্তন বা migration নেই। বিদ্যমান Question, QuestionOption, Subject, Topic, QuestionOccurrence এবং repeat-group model ব্যবহার করা হয়েছে।

## Apply করার আগে

1. নিশ্চিত করুন repository-তে আগের নিরাপদ checkpoint `e989541` (`ocr import export and duplicate detection complete`) checkout করা আছে।
2. `git status` দেখে tracked changes থাকলে সেগুলো আলাদা করে সংরক্ষণ করুন। Untracked backup/PDF/ZIP ফাইল delete করবেন না।
3. এই patch-এর `apps` directory overlay করলে একই path-এর ফাইল replace হবে। তাই আগে অন্তত `apps` folder-এর backup রাখুন।

PowerShell:

```powershell
Set-Location "C:\Projects\DigitalEducationPlatform"

git log -1 --oneline
git status

Copy-Item .\apps .\_backup-before-public-qbank -Recurse -Force

Expand-Archive `
  -LiteralPath .\shikhasetu-public-qbank-patch-fixed.zip `
  -DestinationPath .\_shikhasetu-public-qbank-patch-fixed `
  -Force

Copy-Item `
  -Path .\_shikhasetu-public-qbank-patch-fixed\apps `
  -Destination . `
  -Recurse -Force
```

## Apply করার পর verification

প্রথমে repository root থেকে:

```powershell
npm run typecheck --workspace=@shikhasetu/api
npm run build --workspace=@shikhasetu/api
npm run build --workspace=web
npm run test:public-questions --workspace=@shikhasetu/api
```

Security integration test চালাতে আলাদা `shikhasetu_test` database, `TEST_DATABASE_URL` এবং `CORS_ORIGINS` লাগবে:

```powershell
npm run test:questions-security --workspace=@shikhasetu/api
```

**সতর্কতা:** integration test-এর `TEST_DATABASE_URL` অবশ্যই `shikhasetu_test` নামের আলাদা test database-এ নির্দেশ করতে হবে। Production বা development database-এ এই test চালাবেন না।

Web lint command ইচ্ছাকৃতভাবে এখানে দেওয়া হয়নি, কারণ project-এর বর্তমান `apps/web/package.json` script list এই patch archive-এ নেই।

## Validation status

এই সংশোধিত archive-এর সব `.ts` ও `.tsx` source TypeScript `transpileModule` দিয়ে syntax-transpile করা হয়েছে: **37 files, 0 syntax diagnostics**।

এই environment-এ পূর্ণ API/Web build, Prisma typecheck, browser test বা database-backed integration test চালানো হয়নি। কারণ archive-এ মূল repository, `node_modules`, generated Prisma client এবং test database নেই। তাই এই ফলাফল syntax validation—পূর্ণ build বা runtime pass নয়।

## Contents

Archive-এ 41টি entry রয়েছে: 40টি project file এবং এই README। এতে `.env`, credentials, database dump, `node_modules` বা generated Prisma client নেই।
