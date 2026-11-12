import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';

import { HealthController } from './health.controller';
import { DatabaseController } from './database.controller';

import { DatabaseModule } from './database/database.module';
import { QuestionsModule } from './modules/questions/questions.module';
import { PublicQuestionsModule } from './modules/public-question-bank/public-questions.module';
import { SubjectsModule } from './modules/subjects/subjects.module';
import { TopicsModule } from './modules/subjects/topics.module';
import { InstitutionsModule } from './modules/institutions/institutions.module';
import { ExamsModule } from './modules/exams/exams.module';
import { PostsModule } from './modules/posts/posts.module';
import { OccurrencesModule } from './modules/occurrences/occurrences.module';
import { DuplicatesModule } from './modules/duplicates/duplicates.module';
import { ImportsModule } from './modules/imports/imports.module';
import { ReviewsModule } from './modules/reviews/reviews.module';
import { TagsModule } from './modules/tags/tags.module';
import { AnalyticsModule } from './modules/analytics/analytics.module';
import { AuthModule } from './modules/auth/auth.module';
import { RbacModule } from './modules/rbac/rbac.module';
import { UsersModule } from './modules/users/users.module';
import { AuditModule } from './modules/audit/audit.module';

@Module({
  imports: [
    ThrottlerModule.forRoot([
      {
        name: 'default',
        ttl: 60000,
        limit: 60,
      },
    ]),
    DatabaseModule,
    QuestionsModule,
    PublicQuestionsModule,
    SubjectsModule,
    TopicsModule,
    InstitutionsModule,
    ExamsModule,
    PostsModule,
    OccurrencesModule,
    DuplicatesModule,
    ImportsModule,
    ReviewsModule,
    TagsModule,
    AnalyticsModule,
    AuthModule,
    RbacModule,
    UsersModule,
    AuditModule,
  ],
  controllers: [
    HealthController,
    DatabaseController,
  ],
  providers: [
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule {}
