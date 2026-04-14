import { Module } from "@nestjs/common";
import { RouteController } from "./route.controller";
import { RouteService } from "./route.service";
import { Neo4jModule } from "../neo4j/neo4j.module";

@Module({
  imports: [Neo4jModule],
  controllers: [RouteController],
  providers: [RouteService],
})
export class RouteModule {}
