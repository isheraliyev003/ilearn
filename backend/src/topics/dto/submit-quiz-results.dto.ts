import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsString,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

class QuizResultItemDto {
  @IsString()
  wordId!: string;

  @IsBoolean()
  isCorrect!: boolean;
}

export class SubmitQuizResultsDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(50)
  @ValidateNested({ each: true })
  @Type(() => QuizResultItemDto)
  results!: QuizResultItemDto[];
}
