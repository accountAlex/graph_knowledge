import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Neo4jService } from '../neo4j/neo4j.service';
import { topoSort } from '../neo4j/graph-utils';

export interface StudyPlanItem {
  id: string;
  title: string;
}

@Injectable()
export class StudyPlanService {
  constructor(
    private neo: Neo4jService,
    private prisma: PrismaService,
  ) {}

  async generatePlan(goalTopicId: string, maxDepth = 5): Promise<StudyPlanItem[]> {
    const { topicIds, edges } = await this.neo.getPrereqAncestors(goalTopicId, maxDepth);
    const sorted = topoSort(topicIds, edges);

    const registry = await this.prisma.kgNodeRegistry.findMany({
      where: { id: { in: sorted } },
    });
    const byId = new Map(registry.map((r) => [r.id, r.title]));

    return sorted.map((id) => ({ id, title: byId.get(id) ?? id }));
  }
}
