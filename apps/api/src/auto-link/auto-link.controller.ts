import { Body, Controller, Get, Post, UseGuards } from "@nestjs/common";
import { ApiTags, ApiBearerAuth } from "@nestjs/swagger";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { RolesGuard, Roles } from "../auth/guards/roles.guard";
import { AutoLinkService } from "./auto-link.service";

@ApiTags("AutoLink")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles("ADMIN", "COMPOSER")
@Controller("auto-link")
export class AutoLinkController {
  constructor(private readonly svc: AutoLinkService) {}

  /** Compute suggestions (calls Mistral, may take 5–15 sec for 170 nodes) */
  @Get("suggestions")
  getSuggestions() {
    return this.svc.getSuggestions();
  }

  /** Approve a suggestion → creates PREREQ_REQUIRED edge in Neo4j */
  @Post("approve")
  approve(@Body() body: { fromId: string; toId: string }) {
    return this.svc.approve(body.fromId, body.toId);
  }

  /** Reject — client-side only, no persistent state needed */
  @Post("reject")
  reject(@Body() body: { fromId: string; toId: string }) {
    this.svc.reject(body.fromId, body.toId);
    return { ok: true };
  }
}
