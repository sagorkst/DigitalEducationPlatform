
import {
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';

enum DuplicateReviewStatus {
  CONFIRMED = 'CONFIRMED',
  REJECTED = 'REJECTED',
}

export class ReviewDuplicateDto {
  @IsEnum(DuplicateReviewStatus)
  status!: DuplicateReviewStatus;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  reviewNote?: string;

  @IsOptional()
  @IsUUID()
  reviewedBy?: string;
}
