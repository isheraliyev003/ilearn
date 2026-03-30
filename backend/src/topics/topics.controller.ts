import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Req,
} from '@nestjs/common';
import type { Request } from 'express';
import { AuthService } from '../auth/auth.service';
import { OpenAiService } from '../openai/openai.service';
import { CreateTopicDto } from './dto/create-topic.dto';
import { CreateWordDto } from './dto/create-word.dto';
import { SubmitQuizResultsDto } from './dto/submit-quiz-results.dto';
import { TopicsService } from './topics.service';

@Controller('topics')
export class TopicsController {
  constructor(
    private readonly topics: TopicsService,
    private readonly openAi: OpenAiService,
    private readonly auth: AuthService,
  ) {}

  @Post()
  async create(@Body() dto: CreateTopicDto, @Req() req: Request) {
    const user = await this.auth.requireUser(req.headers.cookie);
    return this.topics.create(user.id, dto);
  }

  @Get()
  async findAll(@Req() req: Request) {
    const user = await this.auth.requireUser(req.headers.cookie);
    return this.topics.findAll(user.id);
  }

  @Get(':topicId')
  async findOne(@Param('topicId') topicId: string, @Req() req: Request) {
    const user = await this.auth.requireUser(req.headers.cookie);
    return this.topics.findById(user.id, topicId);
  }

  @Get(':topicId/quiz')
  async quiz(@Param('topicId') topicId: string, @Req() req: Request) {
    const user = await this.auth.requireUser(req.headers.cookie);
    return this.topics.buildQuiz(user.id, topicId);
  }

  @Post(':topicId/quiz/results')
  async submitQuizResults(
    @Param('topicId') topicId: string,
    @Body() dto: SubmitQuizResultsDto,
    @Req() req: Request,
  ) {
    const user = await this.auth.requireUser(req.headers.cookie);
    return this.topics.submitQuizResults(user.id, topicId, dto.results);
  }

  @Delete(':topicId')
  async removeTopic(@Param('topicId') topicId: string, @Req() req: Request) {
    const user = await this.auth.requireUser(req.headers.cookie);
    await this.topics.remove(user.id, topicId);
    return { ok: true as const };
  }

  @Post(':topicId/words')
  async addWord(
    @Param('topicId') topicId: string,
    @Body() dto: CreateWordDto,
    @Req() req: Request,
  ) {
    const user = await this.auth.requireUser(req.headers.cookie);
    const term = dto.englishTerm.trim();
    await this.topics.assertWordDoesNotExist(user.id, topicId, term);
    const enriched = await this.openAi.enrichTerm(term);

    return this.topics.addWord({
      userId: user.id,
      topicId,
      englishTerm: term,
      uzbekTranslation: enriched.uzbekTranslation,
    });
  }
}
