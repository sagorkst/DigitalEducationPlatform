
import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsInt,
  IsUUID,
  IsUrl,
  IsBoolean,
  MaxLength,
  Min,
  Max,
} from 'class-validator';

export class CreateOccurrenceDto {
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
  @Max(100000)
  sourcePage?: number;

  @IsOptional()
  @IsUrl({ require_protocol: true })
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

  @IsOptional()
  @IsBoolean()
  isPrimary?: boolean;
}
