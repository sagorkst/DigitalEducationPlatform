
import {
  IsUUID,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

export class MergeDuplicateDto {
  @IsUUID()
  primaryQuestionId!: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  reviewNote?: string;

  @IsOptional()
  @IsUUID()
  reviewedBy?: string;
}
