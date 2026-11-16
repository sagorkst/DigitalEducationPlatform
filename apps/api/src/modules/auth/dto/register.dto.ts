import {
  IsEmail,
  IsIn,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';

export const REGISTER_ACCOUNT_TYPES = [
  'GENERAL',
  'STUDENT',
  'JOB_SEEKER',
  'TEACHER',
  'INSTITUTION',
] as const;

export type RegisterAccountType =
  (typeof REGISTER_ACCOUNT_TYPES)[number];

export class RegisterDto {
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  name!: string;

  @IsEmail()
  @MaxLength(150)
  email!: string;

  @IsString()
  @Matches(/^\+?[0-9]{10,15}$/)
  phone!: string;

  @IsIn(REGISTER_ACCOUNT_TYPES)
  accountType!: RegisterAccountType;

  @IsString()
  @MinLength(8)
  @MaxLength(72)
  password!: string;
}