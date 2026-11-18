import { Type } from 'class-transformer';
import {
  IsOptional,
  IsString,
  MaxLength,
  ValidateNested,
  IsObject,
} from 'class-validator';
import { BulkQuestionChangesDto } from './bulk-update-questions.dto';

export class BulkQuestionFilterDto {
  @IsOptional() @IsString() @MaxLength(200) search?: string;
  @IsOptional() @IsString() yearFrom?: string;
  @IsOptional() @IsString() yearTo?: string;
  @IsOptional() @IsString() institution?: string;
  @IsOptional() @IsString() exam?: string;
  @IsOptional() @IsString() post?: string;
  @IsOptional() @IsString() subject?: string;
  @IsOptional() @IsString() topic?: string;
  @IsOptional() @IsString() questionType?: string;
  @IsOptional() @IsString() difficulty?: string;
  @IsOptional() @IsString() status?: string;
  @IsOptional() @IsString() hasAnswer?: string;
  @IsOptional() @IsString() hasExplanation?: string;
  @IsOptional() @IsString() isRepeated?: string;
}

export class BulkFilteredQuestionsDto {
  @IsObject()
  @ValidateNested()
  @Type(() => BulkQuestionFilterDto)
  filters!: BulkQuestionFilterDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => BulkQuestionChangesDto)
  updates?: BulkQuestionChangesDto;
}
