import { Body, Controller, Post } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { RouteService } from "./route.service";

@ApiTags("Route")
@Controller("route")
export class RouteController {
  constructor(private readonly routeService: RouteService) {}

  @Post()
  buildRoute(@Body() body: { goal: string }) {
    return this.routeService.buildRoute((body.goal ?? "").slice(0, 300));
  }
}
