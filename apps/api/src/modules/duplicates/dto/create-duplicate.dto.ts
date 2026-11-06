
import {
  IsUUID,
  IsNumber,
  Min,
  Max,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

export class CreateDuplicateDto {
  @IsUUID()
  questionAId!: string;

  @IsUUID()
  questionBId!: string;

  @IsNumber()
  @Min(0)
  @Max(1)
  similarity!: number;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  reviewNote?: string;
}
