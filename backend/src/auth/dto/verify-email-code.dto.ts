import { IsEmail, IsString, Length, MaxLength } from 'class-validator';

export class VerifyEmailCodeDto {
  @IsEmail()
  @MaxLength(320)
  email!: string;

  @IsString()
  @Length(6, 6)
  code!: string;
}
