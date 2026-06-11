import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  Request,
  UseGuards,
} from "@nestjs/common";
import { ApiTags, ApiBearerAuth } from "@nestjs/swagger";
import { ProgressService } from "./progress.service";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { MasteryLevel } from "../generated/prisma/client";

@ApiTags("Progress")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller("progress")
export class ProgressController {
  constructor(private readonly progress: ProgressService) {}

  /** Get all completed nodeIds for the authenticated user */
  @Get()
  getAll(@Request() req: { user: { id: string } }) {
    return this.progress.getUserProgress(req.user.id);
  }

  /** Get progress summary per topic */
  @Get("summary")
  getSummary(@Request() req: { user: { id: string } }) {
    return this.progress.getSummary(req.user.id);
  }

  /** Get progress for a specific set of nodes (e.g. within a topic) */
  @Get("topic")
  getTopicProgress(
    @Request() req: { user: { id: string } },
    @Query("nodeIds") nodeIds: string,
  ) {
    const ids = nodeIds ? nodeIds.split(",").filter(Boolean) : [];
    return this.progress.getTopicProgress(req.user.id, ids);
  }

  /** Toggle a single node's completion */
  @Post("toggle/:nodeId")
  toggle(
    @Request() req: { user: { id: string } },
    @Param("nodeId") nodeId: string,
  ) {
    return this.progress.toggleNode(req.user.id, nodeId);
  }

  /** Bulk mark/unmark nodes */
  @Post("bulk")
  bulk(
    @Request() req: { user: { id: string } },
    @Body() body: { nodeIds: string[]; completed: boolean },
  ) {
    return this.progress.markNodes(req.user.id, body.nodeIds, body.completed);
  }

  /** Nodes that just became learnable (all prerequisites completed) */
  @Get("unlocked")
  getUnlocked(@Request() req: { user: { id: string } }) {
    return this.progress.getUnlocked(req.user.id);
  }

  /** Recent learning events for the activity feed / weekly summary */
  @Get("events")
  getEvents(
    @Request() req: { user: { id: string } },
    @Query("limit") limit?: string,
  ) {
    return this.progress.getRecentEvents(req.user.id, limit ? Number(limit) : 50);
  }

  /** Record that the user viewed a node (UNSEEN → SEEN) */
  @Post("view/:nodeId")
  view(
    @Request() req: { user: { id: string } },
    @Param("nodeId") nodeId: string,
  ) {
    return this.progress.recordView(req.user.id, nodeId);
  }

  /** Set a finer-grained mastery level for a node */
  @Post("mastery/:nodeId")
  setMastery(
    @Request() req: { user: { id: string } },
    @Param("nodeId") nodeId: string,
    @Body() body: { level: MasteryLevel; confidence?: number },
  ) {
    return this.progress.setMastery(req.user.id, nodeId, body.level, body.confidence);
  }
}
