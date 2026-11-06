import { Module } from '@nestjs/common';

import { HealthController } from './health.controller';
import { DatabaseController } from './database.controller';

import { DatabaseModule } from './database/database.module';
import { QuestionsModule } from './modules/questions/questions.module';
import { SubjectsModule } from './modules/subjects/subjects.module';
import { TopicsModule } from './modules/subjects/topics.module';
import { InstitutionsModule } from './modules/institutions/institutions.module';
import { ExamsModule } from './modules/exams/exams.module';
import { PostsModule } from './modules/posts/posts.module';
import { OccurrencesModule } from './modules/occurrences/occurrences.module';
import { DuplicatesModule } from './modules/duplicates/duplicates.module';
import { ImportsModule } from './modules/imports/imports.module';
import { ReviewsModule } from './modules/reviews/reviews.module';

@Module({
  imports: [
    DatabaseModule,
    QuestionsModule,
    SubjectsModule,
    TopicsModule,
    InstitutionsModule,
    ExamsModule,
    PostsModule,
    OccurrencesModule,
    DuplicatesModule,
    ImportsModule,
    ReviewsModule,
  ],
  controllers: [
    HealthController,
    DatabaseController,
  ],
  providers: [],
})
export class AppModule {}
