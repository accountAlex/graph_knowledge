import { Module } from "@nestjs/common";
import { TopicPageController } from "./topic-page.controller";
import { TopicPageService } from "./topic-page.service";

@Module({
  controllers: [TopicPageController],
  providers: [TopicPageService],
})
export class TopicPageModule {}
