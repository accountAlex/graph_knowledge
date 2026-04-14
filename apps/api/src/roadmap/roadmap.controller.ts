import { Controller, Get, Query } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { RoadmapService } from "./roadmap.service";

@ApiTags("Roadmap")
@Controller("roadmap")
export class RoadmapController {
  constructor(private svc: RoadmapService) {}

  @Get()
  async getRoadmap(
    @Query("track") track = "school",
    @Query("depth") depthStr = "0",
  ) {
    const depth = Math.max(0, Math.min(4, parseInt(depthStr, 10) || 0));
    return this.svc.getRoadmap(track, depth);
  }
}

