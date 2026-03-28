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
import { JwtAuthGuard, PermissionsGuard, RequirePermission } from "@app/common";

@ApiTags("Courts")
@Controller("courts")
export class CourtsController {
  constructor(private readonly courtsService: CourtsService) {}

  @Post()
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermission("courts:create")
  @ApiBearerAuth("JWT")
  @ApiOperation({ summary: "Create court" })
  @ApiBody({ type: CreateCourtDto })
  @ApiResponse({ status: 201, description: "Court created" })
  @ApiResponse({ status: 400, description: "Invalid data" })
  @ApiResponse({ status: 403, description: "Forbidden - missing courts:create permission" })
  create(@Body() dto: CreateCourtDto) {
    return this.courtsService.create(dto);
  }

  @Get("booking-windows")
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermission("courts:view")
  @ApiBearerAuth("JWT")
  @ApiOperation({
    summary:
      "List per-court booking windows (Court Time Slot). Empty until slots are configured for a court.",
  })
  @ApiQuery({ name: "branchId", required: false })
  @ApiQuery({ name: "search", required: false })
  @ApiResponse({ status: 200 })
  listBookingWindows(
    @Query("branchId") branchId?: string,
    @Query("search") search?: string,
  ) {
    return this.courtsService.listCourtBookingWindowsForAdmin(branchId, search);
  }

  @Delete("booking-windows/:windowId")
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermission("courts:delete")
  @ApiBearerAuth("JWT")
  @ApiOperation({
    summary:
      "Remove a court time slot (booking window). Does not delete the court in Court Management.",
  })
  @ApiParam({ name: "windowId" })
  removeBookingWindow(@Param("windowId") windowId: string) {
    return this.courtsService.removeCourtBookingWindow(windowId);
  }

  @Get()
  @ApiOperation({ summary: "List courts (filter by locationId, branchId, status, search, sport)" })
  @ApiQuery({ name: "locationId", required: false })
  @ApiQuery({ name: "branchId", required: false, description: "Filter by branch (courts in locations of this branch)" })
  @ApiQuery({ name: "status", required: false, enum: ["active", "maintenance"] })
  @ApiQuery({ name: "search", required: false, description: "Search by court name" })
  @ApiQuery({ name: "sport", required: false, enum: ["tennis", "pickleball"] })
  @ApiQuery({ name: "sportId", required: false })
  @ApiQuery({ name: "page", required: false, description: "Page index (0-based)" })
  @ApiQuery({ name: "pageSize", required: false, description: "Page size (max 1000, default 500)" })
  @ApiResponse({ status: 200, description: "Paginated list: total, data, paginationInfo" })
  findAll(
    @Query("locationId") locationId?: string,
    @Query("branchId") branchId?: string,
    @Query("status") status?: string,
    @Query("search") search?: string,
    @Query("sport") sport?: string,
    @Query("sportId") sportId?: string,
    @Query("page") page?: string,
    @Query("pageSize") pageSize?: string,
  ) {
    const pageIndex = Math.max(0, parseInt(page ?? "0", 10) || 0);
    const size = Math.min(
      1000,
      Math.max(1, parseInt(pageSize ?? "500", 10) || 500),
    );
    return this.courtsService.findAll(
      locationId,
      branchId,
      status,
      search,
      sport,
      sportId,
      pageIndex,
      size,
    );
  }

  @Get(":id")
  @ApiOperation({ summary: "Get court by id" })
  @ApiParam({ name: "id", description: "Court UUID" })
  @ApiResponse({ status: 200, description: "Court details including coaches assigned to this court" })
  @ApiResponse({ status: 404, description: "Court not found" })
  findOne(@Param("id") id: string) {
    return this.courtsService.findOne(id);
  }

  @Patch(":id")
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermission("courts:update")
  @ApiBearerAuth("JWT")
  @ApiOperation({ summary: "Update court" })
  @ApiParam({ name: "id" })
  @ApiBody({ type: UpdateCourtDto })
  @ApiResponse({ status: 200, description: "Update successful" })
  @ApiResponse({ status: 403, description: "Forbidden - missing courts:update permission" })
  update(@Param("id") id: string, @Body() dto: UpdateCourtDto) {
    return this.courtsService.update(id, dto);
  }

  @Delete(":id")
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermission("courts:delete")
  @ApiBearerAuth("JWT")
  @ApiOperation({ summary: "Delete court" })
  @ApiParam({ name: "id" })
  @ApiResponse({ status: 200, description: "Delete successful" })
  @ApiResponse({ status: 403, description: "Forbidden - missing courts:delete permission" })
  remove(@Param("id") id: string) {
    return this.courtsService.remove(id);
  }
}
