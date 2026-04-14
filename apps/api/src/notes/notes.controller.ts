import { Body, Controller, Delete, Get, Param, Put, Request, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { NotesService } from "./notes.service";

@ApiTags("Notes")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller("notes")
export class NotesController {
  constructor(private readonly notes: NotesService) {}

  @Get(":nodeId")
  getNote(
    @Param("nodeId") nodeId: string,
    @Request() req: { user: { id: string } },
  ) {
    return this.notes.getNote(req.user.id, nodeId);
  }

  @Put(":nodeId")
  upsertNote(
    @Param("nodeId") nodeId: string,
    @Body() body: { content: string },
    @Request() req: { user: { id: string } },
  ) {
    return this.notes.upsertNote(req.user.id, nodeId, body.content ?? "");
  }

  @Delete(":nodeId")
  deleteNote(
    @Param("nodeId") nodeId: string,
    @Request() req: { user: { id: string } },
  ) {
    return this.notes.deleteNote(req.user.id, nodeId);
  }
}
