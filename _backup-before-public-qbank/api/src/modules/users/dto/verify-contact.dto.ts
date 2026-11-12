import { IsString, Matches } from 'class-validator';

export class VerifyContactDto {
  @IsString()
  @Matches(/^\d{6}$/, {
    message: 'Verification code must contain exactly 6 digits.',
  })
  code!: string;
}
