import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaClient, type Topic, type WordEntry } from '@prisma/client';
import { CreateTopicDto } from './dto/create-topic.dto';

@Injectable()
export class TopicsService {
  constructor(private readonly prisma: PrismaClient) {}

  private mapTopicWithProgress(
    topic: Topic & {
      _count?: { words?: number };
      words?: Array<{ isLearned: boolean }>;
    },
  ) {
    const totalWords = topic._count?.words ?? topic.words?.length ?? 0;
    const learnedWords =
      topic.words?.filter((word) => word.isLearned).length ?? 0;

    return {
      id: topic.id,
      title: topic.title,
      totalWords,
      learnedWords,
      createdAt: topic.createdAt,
      updatedAt: topic.updatedAt,
    };
  }

  private normalizeEnglishTerm(value: string): string {
    return value.trim().replace(/\s+/g, ' ').toLowerCase();
  }

  private assertValidEnglishTerm(englishTerm: string) {
    const normalized = englishTerm.trim().replace(/\s+/g, ' ');
    const allowedPattern = /^[A-Za-z]+(?:[ '-][A-Za-z]+|,\s*[A-Za-z]+)*$/;

    if (!normalized) {
      throw new BadRequestException('Please enter an English word or phrase.');
    }

    if (
      /https?:\/\//i.test(normalized) ||
      /www\./i.test(normalized) ||
      /@[A-Za-z0-9_]/.test(normalized)
    ) {
      throw new BadRequestException(
        'Please enter only an English word or phrase, not a link or username.',
      );
    }

    if (!/[A-Za-z]/.test(normalized)) {
      throw new BadRequestException('Please enter an English word or phrase.');
    }

    if (!allowedPattern.test(normalized)) {
      throw new BadRequestException(
        'Only English letters, spaces, commas, apostrophes, and hyphens are allowed.',
      );
    }
  }

  private async findDuplicateWord(topicId: string, englishTerm: string) {
    const normalizedTerm = this.normalizeEnglishTerm(englishTerm);
    const existingWords = await this.prisma.wordEntry.findMany({
      where: { topicId },
      select: {
        id: true,
        englishTerm: true,
      },
    });

    return existingWords.find(
      (word) => this.normalizeEnglishTerm(word.englishTerm) === normalizedTerm,
    );
  }

  private shuffle<T>(items: T[]): T[] {
    const copy = [...items];
    for (let i = copy.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1));
      [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    return copy;
  }

  private sampleQuestionWords(words: WordEntry[], count: number): WordEntry[] {
    const shuffled = this.shuffle(words);
    if (words.length >= count) {
      return shuffled.slice(0, count);
    }

    const result: WordEntry[] = [];
    for (let i = 0; i < count; i += 1) {
      result.push(shuffled[i % shuffled.length]);
    }
    return this.shuffle(result);
  }

  async create(userId: string, dto: CreateTopicDto) {
    const topic = await this.prisma.topic.create({
      data: { title: dto.title.trim(), userId },
    });
    return this.mapTopicWithProgress(topic);
  }

  async findAll(userId: string) {
    const topics = await this.prisma.topic.findMany({
      where: { userId },
      include: {
        _count: {
          select: { words: true },
        },
        words: {
          select: { isLearned: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
    return topics.map((topic) => this.mapTopicWithProgress(topic));
  }

  async findByIdOrThrow(userId: string, id: string) {
    const topic = await this.prisma.topic.findFirst({
      where: { id, userId },
    });
    if (!topic) {
      throw new NotFoundException('Topic not found');
    }
    return topic;
  }

  async findById(userId: string, id: string) {
    const topic = await this.prisma.topic.findFirst({
      where: { id, userId },
      include: {
        _count: {
          select: { words: true },
        },
        words: {
          select: { isLearned: true },
        },
      },
    });
    if (!topic) {
      throw new NotFoundException('Topic not found');
    }
    return this.mapTopicWithProgress(topic);
  }

  async remove(userId: string, id: string) {
    await this.findByIdOrThrow(userId, id);
    await this.prisma.topic.delete({ where: { id } });
  }

  async assertWordDoesNotExist(
    userId: string,
    topicId: string,
    englishTerm: string,
  ) {
    await this.findByIdOrThrow(userId, topicId);
    this.assertValidEnglishTerm(englishTerm);
    const duplicate = await this.findDuplicateWord(topicId, englishTerm);
    if (duplicate) {
      throw new ConflictException('This word already exists in this topic.');
    }
  }

  async addWord(params: {
    userId: string;
    topicId: string;
    englishTerm: string;
    uzbekTranslation: string;
  }) {
    await this.findByIdOrThrow(params.userId, params.topicId);
    this.assertValidEnglishTerm(params.englishTerm);

    const duplicate = await this.findDuplicateWord(
      params.topicId,
      params.englishTerm,
    );
    if (duplicate) {
      throw new ConflictException('This word already exists in this topic.');
    }

    return this.prisma.wordEntry.create({
      data: {
        topicId: params.topicId,
        englishTerm: params.englishTerm,
        uzbekTranslation: params.uzbekTranslation,
        isLearned: false,
      },
    });
  }

  async buildQuiz(userId: string, topicId: string) {
    const topic = await this.prisma.topic.findFirst({
      where: { id: topicId, userId },
      include: {
        words: {
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    if (!topic) {
      throw new NotFoundException('Topic not found');
    }

    const quizableWords = topic.words.filter((word) => !word.isLearned);

    if (quizableWords.length < 4) {
      throw new BadRequestException(
        'You need at least 4 not-yet-learned words in this topic to start a quiz.',
      );
    }

    const selectedWords = this.sampleQuestionWords(quizableWords, 10);
    const questions = selectedWords.map((word, index) => {
      const distractors = this.shuffle(
        quizableWords.filter((candidate) => candidate.id !== word.id),
      ).slice(0, 3);

      const options = this.shuffle([
        word.uzbekTranslation,
        ...distractors.map((candidate) => candidate.uzbekTranslation),
      ]);

      return {
        id: `${word.id}-${index + 1}`,
        wordId: word.id,
        englishTerm: word.englishTerm,
        options,
        correctAnswer: word.uzbekTranslation,
      };
    });

    return {
      topicId: topic.id,
      topicTitle: topic.title,
      totalQuestions: questions.length,
      questions,
    };
  }

  async submitQuizResults(
    userId: string,
    topicId: string,
    results: Array<{ wordId: string; isCorrect: boolean }>,
  ) {
    await this.findByIdOrThrow(userId, topicId);

    const topicWords = await this.prisma.wordEntry.findMany({
      where: { topicId },
      select: { id: true },
    });
    const topicWordIds = new Set(topicWords.map((word) => word.id));

    const mergedResults = new Map<string, boolean>();
    for (const result of results) {
      if (!topicWordIds.has(result.wordId)) {
        throw new BadRequestException('Quiz result contains an invalid word.');
      }

      const previous = mergedResults.get(result.wordId);
      mergedResults.set(
        result.wordId,
        previous == null ? result.isCorrect : previous && result.isCorrect,
      );
    }

    await this.prisma.$transaction(
      Array.from(mergedResults.entries()).map(([wordId, isLearned]) =>
        this.prisma.wordEntry.update({
          where: { id: wordId },
          data: { isLearned },
        }),
      ),
    );

    return { ok: true as const };
  }
}
