import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Request,
  UseGuards,
} from "@nestjs/common";
import { ApiTags, ApiBearerAuth } from "@nestjs/swagger";
import { KnowledgeService } from "./knowledge.service";
import { CreateNodeDto, UpdateNodeDto, UpdateStatusDto, CreateEdgeDto, ImportGraphDto } from "./dto/knowledge.dto";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { RolesGuard, Roles } from "../auth/guards/roles.guard";

@ApiTags("Knowledge Graph")
@Controller("knowledge")
export class KnowledgeController {
  constructor(private readonly service: KnowledgeService) {}

  // ──────────── Nodes (read — public) ────────────

  @Get("nodes")
  listNodes(@Query("role") role?: string) {
    return this.service.listNodes(role);
  }

  @Get("nodes/:id")
  getNode(@Param("id") id: string) {
    return this.service.getNode(id);
  }

  // ──────────── Nodes (write — COMPOSER+) ────────────

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("COMPOSER", "ADMIN")
  @Post("nodes")
  createNode(@Body() dto: CreateNodeDto) {
    return this.service.createNode(dto);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("COMPOSER", "ADMIN")
  @Patch("nodes/:id")
  updateNode(
    @Param("id") id: string,
    @Body() dto: UpdateNodeDto,
    @Request() req: { user: { id: string } },
  ) {
    return this.service.updateNode(id, dto, req.user.id);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("ADMIN")
  @Patch("nodes/:id/status")
  updateStatus(@Param("id") id: string, @Body() dto: UpdateStatusDto) {
    return this.service.updateStatus(id, dto.status);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("COMPOSER", "ADMIN")
  @Delete("nodes/:id")
  deleteNode(@Param("id") id: string) {
    return this.service.deleteNode(id);
  }

  // ──────────── Export / Import ────────────

  @Get("export")
  exportGraph() {
    return this.service.exportGraph();
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("COMPOSER", "ADMIN")
  @Post("import")
  importGraph(@Body() dto: ImportGraphDto) {
    return this.service.importGraph(dto);
  }

  // ──────────── Edges (write — COMPOSER+) ────────────

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("COMPOSER", "ADMIN")
  @Post("edges")
  createEdge(@Body() dto: CreateEdgeDto) {
    return this.service.createEdge(dto);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("COMPOSER", "ADMIN")
  @Delete("edges")
  deleteEdge(
    @Query("from") from: string,
    @Query("to") to: string,
    @Query("type") type: string,
  ) {
    return this.service.deleteEdge(from, to, type);
  }
}
