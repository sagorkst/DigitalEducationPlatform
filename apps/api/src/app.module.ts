import { Module } from '@nestjs/common';

import { HealthController } from './health.controller';
import { DatabaseController } from './database.controller';

import { DatabaseModule } from './database/database.module';
import { QuestionsModule } from './modules/questions/questions.module';
import { SubjectsModule } from './modules/subjects/subjects.module';
import { TopicsModule } from './modules/subjects/topics.module';

@Module({
  imports: [
    DatabaseModule,
    QuestionsModule,
    SubjectsModule,
    TopicsModule,
  ],
  controllers: [
    HealthController,
    DatabaseController,
  ],
  providers: [],
})
export class AppModule {}