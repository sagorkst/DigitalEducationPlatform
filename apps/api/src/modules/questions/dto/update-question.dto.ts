
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
  IsUUID,
  Validate,
  ValidatorConstraint,
  ValidatorConstraintInterface,
  ValidationArguments,
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

export class UpdateQuestionOptionDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(10)
  label!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(2000)
  optionText!: string;

  @IsOptional()
  @IsBoolean()
  isCorrect?: boolean;

  @IsOptional()
  @IsInt()
  @Min(0)
  sortOrder?: number;
}

export class UpdateQuestionOccurrenceDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  institution!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  examName!: string;

  @IsInt()
  @Min(1900)
  @Max(2100)
  examYear!: number;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  postName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  department?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  questionNumber?: number;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  source?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  sourcePage?: number;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  sourceUrl?: string;

  @IsOptional()
  @IsUUID()
  institutionId?: string;

  @IsOptional()
  @IsUUID()
  examId?: string;

  @IsOptional()
  @IsUUID()
  postId?: string;

  @IsOptional()
  @IsUUID()
  sourceDocumentId?: string;
}

@ValidatorConstraint({
  name: 'atLeastOneUpdateField',
  async: false,
})
class AtLeastOneUpdateFieldConstraint
  implements ValidatorConstraintInterface
{
  validate(
    _value: unknown,
    args: ValidationArguments,
  ): boolean {
    const dto = args.object as Record<string, unknown>;

    const allowedFields = [
      'questionText',
      'questionType',
      'subject',
      'topic',
      'subjectId',
      'topicId',
      'correctAnswer',
      'explanation',
      'difficulty',
      'status',
      'options',
      'addOccurrences',
    ];

    return allowedFields.some(
      (field) => dto[field] !== undefined && dto[field] !== null,
    );
  }

  defaultMessage(): string {
    return 'At least one question field must be provided for update.';
  }
}

export class UpdateQuestionDto {
  @Validate(AtLeastOneUpdateFieldConstraint)
  private readonly _atLeastOneUpdateField?: boolean;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(1000)
  questionText?: string;

  @IsOptional()
  @IsEnum(QuestionType)
  questionType?: QuestionType;

  // Legacy text fields.
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  subject?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  topic?: string;

  // Master Subject and Topic relations.
  @IsOptional()
  @IsUUID()
  subjectId?: string;

  @IsOptional()
  @IsUUID()
  topicId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  correctAnswer?: string;

  @IsOptional()
  @IsString()
  @MaxLength(5000)
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
  @Type(() => UpdateQuestionOptionDto)
  options?: UpdateQuestionOptionDto[];

  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => UpdateQuestionOccurrenceDto)
  addOccurrences?: UpdateQuestionOccurrenceDto[];

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  changeNote?: string;
}
