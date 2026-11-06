import { IsEmail, IsOptional, IsString, Matches, MaxLength, MinLength } from 'class-validator';

export class RegisterDto {
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  name!: string;

  @IsOptional()
  @IsEmail()
  @MaxLength(150)
  email?: string;

  @IsOptional()
  @IsString()
  @Matches(/^\+?[0-9]{10,15}$/)
  phone?: string;

  @IsString()
  @MinLength(8)
  @MaxLength(72)
  password!: string;
}
