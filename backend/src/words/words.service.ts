import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, PrismaClient } from '@prisma/client';
import { ListWordsQueryDto } from './dto/list-words-query.dto';

@Injectable()
export class WordsService {
  constructor(private readonly prisma: PrismaClient) {}

  async list(query: ListWordsQueryDto) {
    const topic = await this.prisma.topic.findUnique({
      where: { id: query.topicId },
    });
    if (!topic) {
      throw new NotFoundException('Topic not found');
    }

    const take = Math.min(query.limit ?? 20, 50);
    const q = query.q?.trim();

    const where: Prisma.WordEntryWhereInput = {
      topicId: query.topicId,
      ...(q
        ? {
            OR: [
              { englishTerm: { contains: q, mode: 'insensitive' } },
              { uzbekTranslation: { contains: q, mode: 'insensitive' } },
            ],
          }
        : {}),
      ...(query.cursor ? { id: { lt: query.cursor } } : {}),
    };

    const rows = await this.prisma.wordEntry.findMany({
      where,
      orderBy: { id: 'desc' },
      take: take + 1,
    });

    const hasMore = rows.length > take;
    const items = hasMore ? rows.slice(0, take) : rows;
    const nextCursor = hasMore ? (items[items.length - 1]?.id ?? null) : null;

    return { items, nextCursor };
  }

  async remove(wordId: string) {
    const row = await this.prisma.wordEntry.findUnique({
      where: { id: wordId },
    });
    if (!row) {
      throw new NotFoundException('Word not found');
    }
    await this.prisma.wordEntry.delete({ where: { id: wordId } });
    return { ok: true as const };
  }
}
