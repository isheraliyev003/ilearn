import { IsString, MaxLength, MinLength } from 'class-validator';

export class CreateWordDto {
  @IsString()
  @MinLength(1)
  @MaxLength(500)
  englishTerm!: string;
}
