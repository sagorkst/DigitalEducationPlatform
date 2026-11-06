
import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsUUID,
  MaxLength,
} from 'class-validator';

export class UpdateExamDto {
  @IsOptional()
  @IsUUID()
  institutionId?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  name?: string;

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
