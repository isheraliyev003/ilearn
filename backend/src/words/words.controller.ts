import { Controller, Delete, Get, Param, Query } from '@nestjs/common';
import { ListWordsQueryDto } from './dto/list-words-query.dto';
import { WordsService } from './words.service';

@Controller('words')
export class WordsController {
  constructor(private readonly words: WordsService) {}

  @Get()
  list(@Query() query: ListWordsQueryDto) {
    return this.words.list(query);
  }

  @Delete(':wordId')
  remove(@Param('wordId') wordId: string) {
    return this.words.remove(wordId);
  }
}
