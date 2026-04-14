import { Controller, Get, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { TopicsService } from './topics.service';

@ApiTags('Topics')
@Controller()
export class TopicsController {
  constructor(private svc: TopicsService) {}

  @Get('/topics')
  async list(@Query('track') track = 'school') {
    return this.svc.list(track);
  }
}