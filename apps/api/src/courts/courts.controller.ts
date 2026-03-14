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
import { CourtsService } from "./courts.service";
import { CreateCourtDto } from "./dto/create-court.dto";
import { UpdateCourtDto } from "./dto/update-court.dto";
import { JwtAuthGuard } from "@app/common";

@ApiTags("Courts")
@Controller("courts")
export class CourtsController {
  constructor(private readonly courtsService: CourtsService) {}

  @Post()
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth("JWT")
  @ApiOperation({ summary: "Create court" })
  @ApiBody({ type: CreateCourtDto })
  @ApiResponse({ status: 201, description: "Court created" })
  @ApiResponse({ status: 400, description: "Invalid data" })
  create(@Body() dto: CreateCourtDto) {
    return this.courtsService.create(dto);
  }

  @Get()
  @ApiOperation({ summary: "List courts (filter by branchId, status)" })
  @ApiQuery({ name: "branchId", required: false })
  @ApiQuery({ name: "status", required: false, enum: ["active", "maintenance"] })
  @ApiResponse({ status: 200, description: "Array of courts" })
  findAll(
    @Query("branchId") branchId?: string,
    @Query("status") status?: string,
  ) {
    return this.courtsService.findAll(branchId, status);
  }

  @Get(":id")
  @ApiOperation({ summary: "Get court by id" })
  @ApiParam({ name: "id", description: "Court UUID" })
  @ApiResponse({ status: 200, description: "Court details" })
  @ApiResponse({ status: 404, description: "Court not found" })
  findOne(@Param("id") id: string) {
    return this.courtsService.findOne(id);
  }

  @Patch(":id")
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth("JWT")
  @ApiOperation({ summary: "Update court" })
  @ApiParam({ name: "id" })
  @ApiBody({ type: UpdateCourtDto })
  @ApiResponse({ status: 200, description: "Update successful" })
  update(@Param("id") id: string, @Body() dto: UpdateCourtDto) {
    return this.courtsService.update(id, dto);
  }

  @Delete(":id")
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth("JWT")
  @ApiOperation({ summary: "Delete court" })
  @ApiParam({ name: "id" })
  @ApiResponse({ status: 200, description: "Delete successful" })
  remove(@Param("id") id: string) {
    return this.courtsService.remove(id);
  }
}
