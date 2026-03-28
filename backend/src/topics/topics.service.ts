import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { CreateTopicDto } from './dto/create-topic.dto';

@Injectable()
export class TopicsService {
  constructor(private readonly prisma: PrismaClient) {}

  async create(dto: CreateTopicDto) {
    return this.prisma.topic.create({
      data: { title: dto.title.trim() },
    });
  }

  async findAll() {
    return this.prisma.topic.findMany({
      orderBy: { createdAt: 'desc' },
    });
  }

  async findByIdOrThrow(id: string) {
    const topic = await this.prisma.topic.findUnique({ where: { id } });
    if (!topic) {
      throw new NotFoundException('Topic not found');
    }
    return topic;
  }

  async remove(id: string) {
    await this.findByIdOrThrow(id);
    await this.prisma.topic.delete({ where: { id } });
  }
}
