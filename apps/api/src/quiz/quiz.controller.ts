import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Request,
  UseGuards,
} from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { QuizService } from "./quiz.service";

@ApiTags("Quiz")
@Controller("quiz")
export class QuizController {
  constructor(private readonly quizService: QuizService) {}

  /** List questions for a node (no answers/explanations) */
  @Get(":nodeId")
  listQuestions(@Param("nodeId") nodeId: string) {
    return this.quizService.listQuestions(nodeId);
  }

  /** Submit an answer — requires auth */
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Post("answer")
  submitAnswer(
    @Body() body: { questionId: string; answer: string },
    @Request() req: { user: { id: string } },
  ) {
    return this.quizService.submitAnswer(req.user.id, body.questionId, body.answer);
  }

  /** Per-node stats for authenticated user */
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Get(":nodeId/stats")
  getStats(
    @Param("nodeId") nodeId: string,
    @Request() req: { user: { id: string } },
  ) {
    return this.quizService.getNodeStats(req.user.id, nodeId);
  }

  /** Admin: add a question to a node */
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Post(":nodeId")
  createQuestion(
    @Param("nodeId") nodeId: string,
    @Body()
    body: {
      type: "MULTIPLE_CHOICE" | "TEXT_INPUT";
      question: string;
      options?: string[];
      answer: string;
      explanation?: string;
    },
  ) {
    return this.quizService.createQuestion(nodeId, body);
  }

  /** Admin: delete a question */
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Delete("question/:id")
  deleteQuestion(@Param("id") id: string) {
    return this.quizService.deleteQuestion(id);
  }
}
