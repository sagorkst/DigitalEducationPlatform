import { Module } from '@nestjs/common';
import { PublicQuestionsController } from './public-questions.controller';
import { PublicQuestionsService } from './public-questions.service';

@Module({
  controllers: [PublicQuestionsController],
  providers: [PublicQuestionsService],
})
export class PublicQuestionsModule {}
