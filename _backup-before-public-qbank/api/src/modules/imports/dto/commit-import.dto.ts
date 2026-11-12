import {
  IsArray,
  IsOptional,
  IsUUID,
  ArrayMinSize,
  ArrayMaxSize,
} from 'class-validator';

export class CommitImportDto {
  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(10000)
  @IsUUID('4', { each: true })
  rowIds?: string[];
}