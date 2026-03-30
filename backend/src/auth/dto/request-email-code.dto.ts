import { IsEmail, IsString, MaxLength, MinLength } from 'class-validator';

export class RequestEmailCodeDto {
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  fullName!: string;

  @IsEmail()
  @MaxLength(320)
  email!: string;
}
