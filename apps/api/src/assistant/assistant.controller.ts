import { Body, Controller, Delete, Get, Param, Post, Req, UseGuards } from "@nestjs/common";
import { ApiTags, ApiOperation, ApiBearerAuth } from "@nestjs/swagger";
import { Throttle } from "@nestjs/throttler";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { AssistantService } from "./assistant.service";
import { AskDto, AskResponse, CreateSessionDto, SendMessageDto } from "./dto/assistant.dto";

@ApiTags("Assistant")
@Controller("assistant")
export class AssistantController {
  constructor(private svc: AssistantService) {}

  // ── Anonymous (no auth) ──
  @Post("ask")
  @Throttle({ default: { ttl: 60_000, limit: 20 } })
  @ApiOperation({ summary: "Ask the AI math assistant (anonymous, no history saved)" })
  async ask(@Body() dto: AskDto): Promise<AskResponse> {
    const answer = await this.svc.ask(dto.question, dto.topicId, dto.history);
    return { answer };
  }

  // ── Authenticated chat sessions ──
  @Post("sessions")
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: "Create a new chat session" })
  async createSession(@Req() req: any, @Body() dto: CreateSessionDto) {
    return this.svc.createSession(req.user.id, dto.topicId);
  }

  @Get("sessions")
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: "List user chat sessions" })
  async listSessions(@Req() req: any) {
    return this.svc.listSessions(req.user.id);
  }

  @Get("sessions/:id")
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: "Get chat session with messages" })
  async getSession(@Req() req: any, @Param("id") id: string) {
    return this.svc.getSession(id, req.user.id);
  }

  @Delete("sessions/:id")
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: "Delete a chat session" })
  async deleteSession(@Req() req: any, @Param("id") id: string) {
    return this.svc.deleteSession(id, req.user.id);
  }

  @Post("sessions/:id/message")
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: "Send a message in a chat session" })
  async sendMessage(@Req() req: any, @Param("id") id: string, @Body() dto: SendMessageDto) {
    return this.svc.sendMessage(id, req.user.id, dto.question);
  }
}
