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
}
