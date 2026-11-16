import {
  IsString,
  IsOptional,
  IsUUID,
  IsInt,
  Min,
  Max,
  MaxLength,
} from 'class-validator';

export class UpdateExamDto {
  @IsOptional()
  @IsUUID()
  institutionId?: string;

  @IsOptional()
  @IsUUID()
  postId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  name?: string;

  @IsOptional()
  @IsInt()
  @Min(1900)
  @Max(2100)
  examYear?: number;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  slug?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  examType?: string;

  @IsOptional()
  @IsString()
  @MaxLength(5000)
  description?: string;
}
