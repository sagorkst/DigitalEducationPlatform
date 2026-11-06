import { IsEmail, IsString, MaxLength } from 'class-validator';

export class ForgotPasswordDto {
  @IsEmail()
  @MaxLength(254)
  email!: string;
}