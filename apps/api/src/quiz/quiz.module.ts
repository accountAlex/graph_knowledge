import { Module } from "@nestjs/common";
import { QuizController } from "./quiz.controller";
import { QuizService } from "./quiz.service";
import { ProgressModule } from "../progress/progress.module";

@Module({
  imports: [ProgressModule],
  controllers: [QuizController],
  providers: [QuizService],
})
export class QuizModule {}
