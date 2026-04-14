import { Controller, Get, Query } from "@nestjs/common";
import { ApiTags, ApiQuery } from "@nestjs/swagger";
import { SearchService } from "./search.service";

@ApiTags("Search")
@Controller("search")
export class SearchController {
  constructor(private readonly searchService: SearchService) {}

  @Get()
  @ApiQuery({ name: "q", required: true, example: "квадратные уравнения" })
  @ApiQuery({ name: "limit", required: false, example: 20 })
  search(
    @Query("q") q = "",
    @Query("limit") limit?: string,
  ) {
    return this.searchService.search(q, limit ? Math.min(Number(limit), 50) : 20);
  }
}
