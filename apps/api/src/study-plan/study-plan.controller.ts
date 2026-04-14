import { Controller, Get, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { StudyPlanService } from './study-plan.service';

@ApiTags('Study Plan')
@Controller('study-plan')
export class StudyPlanController {
  constructor(private readonly studyPlanService: StudyPlanService) {}

  @Get()
  async generatePlan(
    @Query('goalTopicId') goalTopicId: string,
    @Query('maxDepth') maxDepth = 5,
  ) {
    return this.studyPlanService.generatePlan(goalTopicId, Number(maxDepth));
  }
}