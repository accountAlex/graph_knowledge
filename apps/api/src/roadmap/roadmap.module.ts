import { Module } from "@nestjs/common";
import { RoadmapController } from "./roadmap.controller";
import { RoadmapService } from "./roadmap.service";
import { Neo4jModule } from "../neo4j/neo4j.module";

@Module({
  imports: [Neo4jModule],
  controllers: [RoadmapController],
  providers: [RoadmapService],
})
export class RoadmapModule {}
