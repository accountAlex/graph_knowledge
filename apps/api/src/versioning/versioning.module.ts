import { Module } from "@nestjs/common";
import { VersioningController } from "./versioning.controller";
import { VersioningService } from "./versioning.service";

@Module({
  controllers: [VersioningController],
  providers: [VersioningService],
})
export class VersioningModule {}
