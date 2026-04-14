import { Module } from "@nestjs/common";
import { APP_GUARD } from "@nestjs/core";
import { ThrottlerModule, ThrottlerGuard } from "@nestjs/throttler";
import { PrismaModule } from "./prisma/prisma.module";
import { Neo4jModule } from "./neo4j/neo4j.module";
import { RedisModule } from "./redis/redis.module";
import { CommonModule } from "./common/common.module";
import { TopicPageModule } from "./topic-page/topic-page.module";
import { TopicsModule } from "./topics/topics.module";
import { StudyPlanModule } from './study-plan/study-plan.module';
import { KnowledgeModule } from './knowledge/knowledge.module';
import { RoadmapModule } from './roadmap/roadmap.module';
import { AuthModule } from './auth/auth.module';
import { AssistantModule } from './assistant/assistant.module';
import { ProgressModule } from './progress/progress.module';
import { AnalyticsModule } from './analytics/analytics.module';
import { VersioningModule } from './versioning/versioning.module';
import { SearchModule } from './search/search.module';
import { NotesModule } from './notes/notes.module';
import { QuizModule } from './quiz/quiz.module';
import { RouteModule } from './route/route.module';
import { AutoLinkModule } from './auto-link/auto-link.module';

@Module({
  imports: [
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 60 }]),
    PrismaModule,
    Neo4jModule,
    RedisModule,
    CommonModule,
    TopicPageModule,
    TopicsModule,
    StudyPlanModule,
    KnowledgeModule,
    RoadmapModule,
    AuthModule,
    AssistantModule,
    ProgressModule,
    AnalyticsModule,
    VersioningModule,
    SearchModule,
    NotesModule,
    QuizModule,
    RouteModule,
    AutoLinkModule,
  ],
  providers: [
    { provide: APP_GUARD, useClass: ThrottlerGuard },
  ],
})
export class AppModule {}
