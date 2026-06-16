import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Query,
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

  /** Build an exam variant — shuffled questions, no answers (static route first) */
  @Get("exam")
  getExam(@Query("limit") limit?: string) {
    return this.quizService.getExam(limit ? Number(limit) : 15);
  }

  /** Build a topic diagnostic — spread of questions, no answers (static route first) */
  @Get("diagnostic")
  getDiagnostic(
    @Query("topicId") topicId: string,
    @Query("limit") limit?: string,
  ) {
    return this.quizService.getDiagnostic(topicId, limit ? Number(limit) : 10);
  }

  /** Submit a completed diagnostic — grades answers and updates mastery */
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Post("diagnostic/submit")
  submitDiagnostic(
    @Body() body: { answers: { questionId: string; answer: string }[] },
    @Request() req: { user: { id: string } },
  ) {
    return this.quizService.submitDiagnostic(req.user.id, body.answers ?? []);
  }

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
