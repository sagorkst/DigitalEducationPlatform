
import { Module } from '@nestjs/common';

import { HealthController } from './health.controller';
import { DatabaseController } from './database.controller';

import { DatabaseModule } from './database/database.module';
import { QuestionsModule } from './modules/questions/questions.module';

@Module({
  imports: [
    DatabaseModule,
    QuestionsModule,
  ],
  controllers: [
    HealthController,
    DatabaseController,
  ],
  providers: [],
})
export class AppModule {}
