import { Controller, Get, Param, Query } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { TopicPageService } from "./topic-page.service";

@ApiTags("Topic Page")
@Controller()
export class TopicPageController {
  constructor(private svc: TopicPageService) {}

  @Get("/topic/:topicId/page")
  async get(
    @Param("topicId") topicId: string,
    @Query("track") track = "school",
    @Query("depth") depthStr = "0"
  ) {
    const depth = Number(depthStr);
    return this.svc.getTopicPage(topicId, track, Number.isFinite(depth) ? depth : 0);
  }
}
