import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
  UseGuards,
} from "@nestjs/common";
import {
  ApiTags,
  ApiOperation,
  ApiBody,
  ApiParam,
  ApiQuery,
  ApiResponse,
  ApiBearerAuth,
} from "@nestjs/swagger";
import { CoachesService } from "./coaches.service";
import { CreateCoachDto } from "./dto/create-coach.dto";
import { UpdateCoachDto } from "./dto/update-coach.dto";
import { JwtAuthGuard } from "@app/common";

@ApiTags("Coaches")
@Controller("coaches")
export class CoachesController {
  constructor(private readonly coachesService: CoachesService) {}

  @Post()
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth("JWT")
  @ApiOperation({ summary: "Create coach" })
  @ApiBody({ type: CreateCoachDto })
  @ApiResponse({ status: 201, description: "Coach created" })
  @ApiResponse({ status: 400, description: "Invalid data" })
  create(@Body() dto: CreateCoachDto) {
    return this.coachesService.create(dto);
  }

  @Get()
  @ApiOperation({
    summary:
      "Coach directory: unassigned coaches (no court) with public visibility",
  })
  @ApiQuery({ name: "branchId", required: false, description: "Filter by branch" })
  @ApiQuery({ name: "page", required: false, description: "Page index (0-based)" })
  @ApiQuery({ name: "pageSize", required: false, description: "Page size (max 500, default 100)" })
  @ApiResponse({ status: 200, description: "Paginated list: total, data, paginationInfo" })
  findAll(
    @Query("branchId") branchId?: string,
    @Query("page") page?: string,
    @Query("pageSize") pageSize?: string,
  ) {
    const pageIndex = Math.max(0, parseInt(page ?? "0", 10) || 0);
    const size = Math.min(
      500,
      Math.max(1, parseInt(pageSize ?? "100", 10) || 100),
    );
    return this.coachesService.findDirectory(branchId, pageIndex, size);
  }

  @Get(":id")
  @ApiOperation({ summary: "Get coach by id" })
  @ApiParam({ name: "id", description: "Coach UUID" })
  @ApiResponse({ status: 200, description: "Coach details" })
  @ApiResponse({ status: 404, description: "Coach not found" })
  findOne(@Param("id") id: string) {
    return this.coachesService.findOne(id);
  }

  @Patch(":id")
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth("JWT")
  @ApiOperation({ summary: "Update coach" })
  @ApiParam({ name: "id" })
  @ApiBody({ type: UpdateCoachDto })
  @ApiResponse({ status: 200, description: "Update successful" })
  update(@Param("id") id: string, @Body() dto: UpdateCoachDto) {
    return this.coachesService.update(id, dto);
  }

  @Delete(":id")
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth("JWT")
  @ApiOperation({ summary: "Delete coach" })
  @ApiParam({ name: "id" })
  @ApiResponse({ status: 200, description: "Delete successful" })
  remove(@Param("id") id: string) {
    return this.coachesService.remove(id);
  }
}
