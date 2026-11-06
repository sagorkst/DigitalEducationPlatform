import {
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

export class SubmitReviewDto {
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  submissionNote?: string;
}
