import {
  IsString,
  MinLength,
  MaxLength,
} from 'class-validator';

export class RejectReviewDto {
  @IsString()
  @MinLength(3)
  @MaxLength(2000)
  reviewNote!: string;
}
