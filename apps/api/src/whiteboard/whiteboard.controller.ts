import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Request,
  UseGuards,
} from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { WhiteboardService } from "./whiteboard.service";
import {
  AddMemberDto,
  CreateWhiteboardDto,
  JoinBoardDto,
  ShareLinkDto,
  UpdateMemberDto,
  UpdateWhiteboardDto,
} from "./dto/whiteboard.dto";

type AuthedReq = { user: { id: string } };

@ApiTags("Whiteboards")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller("whiteboards")
export class WhiteboardController {
  constructor(private readonly boards: WhiteboardService) {}

  @Post()
  create(@Body() dto: CreateWhiteboardDto, @Request() req: AuthedReq) {
    return this.boards.create(req.user.id, dto);
  }

  @Get()
  list(@Request() req: AuthedReq) {
    return this.boards.list(req.user.id);
  }

  // Static route — must stay above the `:id` routes.
  @Post("join")
  join(@Body() dto: JoinBoardDto, @Request() req: AuthedReq) {
    return this.boards.joinByToken(req.user.id, dto.token);
  }

  @Get(":id")
  get(@Param("id") id: string, @Request() req: AuthedReq) {
    return this.boards.get(req.user.id, id);
  }

  @Patch(":id")
  rename(@Param("id") id: string, @Body() dto: UpdateWhiteboardDto, @Request() req: AuthedReq) {
    return this.boards.rename(req.user.id, id, dto.title);
  }

  @Delete(":id")
  remove(@Param("id") id: string, @Request() req: AuthedReq) {
    return this.boards.remove(req.user.id, id);
  }

  @Post(":id/members")
  addMember(@Param("id") id: string, @Body() dto: AddMemberDto, @Request() req: AuthedReq) {
    return this.boards.addMember(req.user.id, id, dto.email, dto.role ?? "EDITOR");
  }

  @Patch(":id/members/:userId")
  updateMember(
    @Param("id") id: string,
    @Param("userId") memberUserId: string,
    @Body() dto: UpdateMemberDto,
    @Request() req: AuthedReq,
  ) {
    return this.boards.updateMember(req.user.id, id, memberUserId, dto.role);
  }

  @Delete(":id/members/:userId")
  removeMember(
    @Param("id") id: string,
    @Param("userId") memberUserId: string,
    @Request() req: AuthedReq,
  ) {
    return this.boards.removeMember(req.user.id, id, memberUserId);
  }

  @Post(":id/share")
  createShare(@Param("id") id: string, @Body() dto: ShareLinkDto, @Request() req: AuthedReq) {
    return this.boards.createShareLink(req.user.id, id, dto.role);
  }

  @Delete(":id/share")
  revokeShare(@Param("id") id: string, @Request() req: AuthedReq) {
    return this.boards.revokeShareLink(req.user.id, id);
  }
}
