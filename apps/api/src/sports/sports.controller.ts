import { Controller, Get, Query } from "@nestjs/common";
import { ApiTags, ApiOperation, ApiQuery, ApiResponse } from "@nestjs/swagger";
import { SportsService } from "./sports.service";

@ApiTags("Sports")
@Controller("sports")
export class SportsController {
  constructor(private readonly sportsService: SportsService) {}

  @Get()
  @ApiOperation({ summary: "List all sports (for dynamic sport selector)" })
  @ApiResponse({ status: 200, description: "Array of sports" })
  findAll() {
    return this.sportsService.findAll();
  }
}
