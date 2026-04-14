import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export type TopicListItem = { id: string; title: string };

@Injectable()
export class TopicsService {
  constructor(private prisma: PrismaService) {}

  async list(track: string): Promise<TopicListItem[]> {
    const views = await this.prisma.topicView.findMany({
      where: { track },
      select: { topicId: true },
    });

    const topicIds = Array.from(new Set(views.map((v) => v.topicId)));
    if (topicIds.length === 0) return [];

    const nodes = await this.prisma.kgNodeRegistry.findMany({
      where: { id: { in: topicIds } },
      select: { id: true, title: true },
      orderBy: { title: 'asc' },
    });

    return nodes;
  }
}