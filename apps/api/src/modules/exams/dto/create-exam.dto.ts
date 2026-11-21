import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsUUID,
  IsInt,
  Min,
  Max,
  MaxLength,
} from 'class-validator';

export class CreateExamDto {
  @IsOptional()
  @IsUUID()
  institutionId?: string;

  @IsOptional()
  @IsUUID()
  postId?: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  name!: string;

  @IsInt()
  @Min(1900)
  @Max(2100)
  examYear!: number;

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
  @MaxLength(100)
  grade?: string;

  @IsOptional()
  @IsString()
  @MaxLength(5000)
  description?: string;
}
