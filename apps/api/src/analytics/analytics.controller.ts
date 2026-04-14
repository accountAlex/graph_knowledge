import { Controller, Get, Request, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { AnalyticsService } from "./analytics.service";

@ApiTags("Analytics")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller("analytics")
export class AnalyticsController {
  constructor(private readonly analytics: AnalyticsService) {}

  @Get("summary")
  summary(@Request() req: { user: { id: string } }) {
    return this.analytics.getSummary(req.user.id);
  }

  @Get("activity")
  activity(@Request() req: { user: { id: string } }) {
    return this.analytics.getActivity(req.user.id);
  }

  @Get("by-role")
  byRole(@Request() req: { user: { id: string } }) {
    return this.analytics.getByRole(req.user.id);
  }

  @Get("timeline")
  timeline(@Request() req: { user: { id: string } }) {
    return this.analytics.getTimeline(req.user.id);
  }
}
