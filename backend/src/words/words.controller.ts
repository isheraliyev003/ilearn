import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Query,
  Req,
} from '@nestjs/common';
import type { Request } from 'express';
import { AuthService } from '../auth/auth.service';
import { ListWordsQueryDto } from './dto/list-words-query.dto';
import { UpdateWordTranslationDto } from './dto/update-word-translation.dto';
import { WordsService } from './words.service';

@Controller('words')
export class WordsController {
  constructor(
    private readonly words: WordsService,
    private readonly auth: AuthService,
  ) {}

  @Get()
  async list(@Query() query: ListWordsQueryDto, @Req() req: Request) {
    const user = await this.auth.requireUser(req.headers.cookie);
    return this.words.list(user.id, query);
  }

  @Delete(':wordId')
  async remove(@Param('wordId') wordId: string, @Req() req: Request) {
    const user = await this.auth.requireUser(req.headers.cookie);
    return this.words.remove(user.id, wordId);
  }

  @Patch(':wordId')
  async updateTranslation(
    @Param('wordId') wordId: string,
    @Body() dto: UpdateWordTranslationDto,
    @Req() req: Request,
  ) {
    const user = await this.auth.requireUser(req.headers.cookie);
    return this.words.updateTranslation(user.id, wordId, dto.uzbekTranslation);
  }
}
