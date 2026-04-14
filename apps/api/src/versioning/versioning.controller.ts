import { Controller, Get, Param, ParseIntPipe, Post, Request, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { RolesGuard, Roles } from "../auth/guards/roles.guard";
import { VersioningService } from "./versioning.service";

@ApiTags("Versioning")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller("versioning/nodes")
export class VersioningController {
  constructor(private readonly versioning: VersioningService) {}

  @Get(":nodeId/versions")
  listVersions(@Param("nodeId") nodeId: string) {
    return this.versioning.listVersions(nodeId);
  }

  @Get(":nodeId/versions/:version")
  getVersion(
    @Param("nodeId") nodeId: string,
    @Param("version", ParseIntPipe) version: number,
  ) {
    return this.versioning.getVersion(nodeId, version);
  }

  @Post(":nodeId/revert/:version")
  @UseGuards(RolesGuard)
  @Roles("ADMIN", "COMPOSER")
  revert(
    @Param("nodeId") nodeId: string,
    @Param("version", ParseIntPipe) version: number,
    @Request() req: { user: { id: string } },
  ) {
    return this.versioning.revertToVersion(nodeId, version, req.user.id);
  }
}
