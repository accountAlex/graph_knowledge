import { Module } from "@nestjs/common";
import { JwtModule } from "@nestjs/jwt";
import { WhiteboardController } from "./whiteboard.controller";
import { WhiteboardService } from "./whiteboard.service";
import { WhiteboardSyncService } from "./whiteboard-sync.service";

@Module({
  imports: [JwtModule.register({})],
  controllers: [WhiteboardController],
  providers: [WhiteboardService, WhiteboardSyncService],
  // WhiteboardService: reused by the Hocuspocus auth hook.
  // WhiteboardSyncService: resolved in main.ts to bind the collab WS to the HTTP server.
  exports: [WhiteboardService, WhiteboardSyncService],
})
export class WhiteboardModule {}
