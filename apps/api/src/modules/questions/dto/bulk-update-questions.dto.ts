import {
  IsArray,
  ArrayMinSize,
  ArrayMaxSize,
  ArrayUnique,
  IsUUID,
  IsOptional,
  IsEnum,
  IsString,
  IsNotEmpty,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

enum Difficulty {
  EASY = 'EASY',
  MEDIUM = 'MEDIUM',
  HARD = 'HARD',
}

enum QuestionStatus {
  DRAFT = 'DRAFT',
  PUBLISHED = 'PUBLISHED',
  HIDDEN = 'HIDDEN',
  ARCHIVED = 'ARCHIVED',
}

export class BulkQuestionChangesDto {
  @IsOptional()
  @IsEnum(Difficulty)
  difficulty?: Difficulty;

  @IsOptional()
  @IsEnum(QuestionStatus)
  status?: QuestionStatus;

  @IsOptional()
  @IsUUID()
  subjectId?: string;

  @IsOptional()
  @IsUUID()
  topicId?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(1000)
  changeNote?: string;
}

export class BulkUpdateQuestionsDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(500)
  @ArrayUnique()
  @IsUUID('4', { each: true })
  ids!: string[];

  @ValidateNested()
  @Type(() => BulkQuestionChangesDto)
  updates!: BulkQuestionChangesDto;
}