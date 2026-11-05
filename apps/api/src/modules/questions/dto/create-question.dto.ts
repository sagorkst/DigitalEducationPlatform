
import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsEnum,
  IsInt,
  Min,
  Max,
  IsArray,
  ValidateNested,
  ArrayMinSize,
  ArrayMaxSize,
  IsBoolean,
  MaxLength,
} from 'class-validator';

import { Type } from 'class-transformer';

enum QuestionType {
  MCQ = 'MCQ',
  TRUE_FALSE = 'TRUE_FALSE',
  FILL_IN_THE_BLANKS = 'FILL_IN_THE_BLANKS',
  WRITTEN = 'WRITTEN',
}

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

class QuestionOptionDto {
  @IsString()
  @IsNotEmpty()
  label!: string;

  @IsString()
  @IsNotEmpty()
  optionText!: string;

  @IsOptional()
  @IsBoolean()
  isCorrect?: boolean;

  @IsOptional()
  @IsInt()
  @Min(0)
  sortOrder?: number;
}

class QuestionOccurrenceDto {
  @IsString()
  @IsNotEmpty()
  institution!: string;

  @IsString()
  @IsNotEmpty()
  examName!: string;

  @IsInt()
  @Min(1900)
  @Max(2100)
  examYear!: number;

  @IsOptional()
  @IsString()
  postName?: string;

  @IsOptional()
  @IsString()
  department?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  questionNumber?: number;

  @IsOptional()
  @IsString()
  source?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  sourcePage?: number;

  @IsOptional()
  @IsString()
  sourceUrl?: string;
}

export class CreateQuestionDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(1000)
  questionText!: string;

  @IsOptional()
  @IsEnum(QuestionType)
  questionType?: QuestionType;

  @IsString()
  @IsNotEmpty()
  subject!: string;

  @IsString()
  @IsNotEmpty()
  topic!: string;

  @IsOptional()
  @IsString()
  correctAnswer?: string;

  @IsOptional()
  @IsString()
  explanation?: string;

  @IsOptional()
  @IsEnum(Difficulty)
  difficulty?: Difficulty;

  @IsOptional()
  @IsEnum(QuestionStatus)
  status?: QuestionStatus;

  @IsOptional()
  @IsArray()
  @ArrayMinSize(2)
  @ArrayMaxSize(10)
  @ValidateNested({ each: true })
  @Type(() => QuestionOptionDto)
  options?: QuestionOptionDto[];

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => QuestionOccurrenceDto)
  occurrences!: QuestionOccurrenceDto[];
}
