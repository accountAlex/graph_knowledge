import { Module } from "@nestjs/common";
import { AutoLinkController } from "./auto-link.controller";
import { AutoLinkService } from "./auto-link.service";

@Module({
  controllers: [AutoLinkController],
  providers: [AutoLinkService],
})
export class AutoLinkModule {}
