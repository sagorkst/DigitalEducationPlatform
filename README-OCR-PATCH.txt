SHIKHASETU OCR IMPORT - CONSOLIDATED PATCH
===========================================

এই ZIP-টি DigitalEducationPlatform project root থেকে Extract করুন।
ZIP-এর apps/ ফোল্ডারগুলো সরাসরি project-এর apps/ ফোল্ডারে বসবে।

PowerShell:
  Set-Location "C:\Projects\DigitalEducationPlatform"
  Expand-Archive -LiteralPath ".\shikhasetu-ocr-complete-patch.zip" -DestinationPath "." -Force

এরপর একবারে Final Build:
  npm run build --workspace=@shikhasetu/api
  npm run build --workspace=web

এই Patch-এ:
- OCR PDF/Image Preview ও OCR History batch creation
- প্রতিটি OCR question-এর editable History row
- Auto-save + Manual Save Progress
- History থেকে অসমাপ্ত OCR batch Resume
- Resume-এর সময় Duplicate re-check
- Existing Duplicate Similarity Logic ব্যবহার করে Database ও একই OCR batch-এ match check
- Duplicate পাওয়া গেলে Skip অথবা Save Anyway সিদ্ধান্ত
- Duplicate scan latest 5,000 active questions পর্যন্ত; scan আরও বড় হলে UI সতর্ক করে এবং explicit consent ছাড়া Save বন্ধ রাখে
- Manual verification ছাড়া Question Save নয়
- Save হলে DRAFT status
- একাধিক প্রশ্ন sequential batch save, row-level failure status এবং retry-এর আগে duplicate re-check
- History-তে Imported, Skipped, Duplicate, Invalid/Failed count এবং Question ID
- OCR History detail-এ OCR batch-এর সব row দেখানো
- Rollback button কেবল imported question থাকলে দেখানো

সীমা:
- প্রতি ফাইল সর্বোচ্চ 10 MB
- PDF সর্বোচ্চ 20 পৃষ্ঠা
- প্রতি OCR batch সর্বোচ্চ 200 প্রশ্ন
- Subject, Topic, Institution, Exam Name ও Year Save-এর আগে দিতে হবে
- Duplicate similarity বর্তমান Duplicate module-এর text-based Jaccard logic এবং 0.8 threshold ব্যবহার করে; এটি semantic AI matching নয়।

Database:
- বিদ্যমান ImportBatch ও ImportRow model ব্যবহার করা হয়েছে।
- কোনো Prisma schema change বা migration এই Patch-এর জন্য প্রয়োজন নেই।

গুরুত্বপূর্ণ:
- এই Patch লাগানোর পরের OCR upload-গুলো History Batch তৈরি করবে।
- History integration চালুর আগের OCR runs-এর জন্য পুরোনো কোনো History Batch স্বয়ংক্রিয়ভাবে তৈরি করা যাবে না।
- Extract করার আগে project-এর বর্তমান source files-এর backup রাখুন।
- Build সফল হওয়ার আগে source control commit/push করবেন না।
