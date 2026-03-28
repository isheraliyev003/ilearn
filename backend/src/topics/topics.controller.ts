import { Body, Controller, Delete, Get, Param, Post } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { OpenAiService } from '../openai/openai.service';
import { CreateTopicDto } from './dto/create-topic.dto';
import { CreateWordDto } from './dto/create-word.dto';
import { TopicsService } from './topics.service';

@Controller('topics')
export class TopicsController {
  constructor(
    private readonly topics: TopicsService,
    private readonly prisma: PrismaClient,
    private readonly openAi: OpenAiService,
  ) {}

  @Post()
  create(@Body() dto: CreateTopicDto) {
    return this.topics.create(dto);
  }

  @Get()
  findAll() {
    return this.topics.findAll();
  }

  @Get(':topicId')
  findOne(@Param('topicId') topicId: string) {
    return this.topics.findByIdOrThrow(topicId);
  }

  @Delete(':topicId')
  async removeTopic(@Param('topicId') topicId: string) {
    await this.topics.remove(topicId);
    return { ok: true as const };
  }

  @Post(':topicId/words')
  async addWord(@Param('topicId') topicId: string, @Body() dto: CreateWordDto) {
    await this.topics.findByIdOrThrow(topicId);
    const term = dto.englishTerm.trim();
    const enriched = await this.openAi.enrichTerm(term);

    return this.prisma.wordEntry.create({
      data: {
        topicId,
        englishTerm: term,
        uzbekTranslation: enriched.uzbekTranslation,
      },
    });
  }
}
