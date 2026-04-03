import {
  BadRequestException,
  Controller,
  DefaultValuePipe,
  Get,
  ParseIntPipe,
  Query,
  UseGuards,
} from "@nestjs/common";
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from "@nestjs/swagger";
import { JwtAuthGuard } from "@app/common";
import { AdminRoleGuard } from "./admin-role.guard";
import {
  AdminService,
  DashboardMetricsDto,
  DayBookingDrilldownPageDto,
  KpiDrilldownPageDto,
  SportBookingBreakdownDto,
  SportBreakdownDrilldownPageDto,
} from "./admin.service";

@ApiTags("Admin")
@Controller("admin/dashboard")
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  @Get("metrics")
  @UseGuards(JwtAuthGuard, AdminRoleGuard)
  @ApiBearerAuth("JWT")
  @ApiOperation({
    summary: "Aggregate metrics for admin analytics dashboard",
  })
  @ApiResponse({ status: 200, description: "Dashboard metrics" })
  @ApiResponse({ status: 403, description: "Not an admin" })
  getMetrics(): Promise<DashboardMetricsDto> {
    return this.adminService.getDashboardMetrics();
  }

  @Get("metrics/by-sport")
  @UseGuards(JwtAuthGuard, AdminRoleGuard)
  @ApiBearerAuth("JWT")
  @ApiOperation({
    summary:
      "Breakdown of court bookings for one sport (same 14-day window as dashboard charts)",
  })
  @ApiResponse({ status: 200, description: "Counts by role, booking type, account type" })
  @ApiResponse({ status: 400, description: "Missing sport query param" })
  @ApiResponse({ status: 403, description: "Not an admin" })
  getSportBreakdown(@Query("sport") sport?: string): Promise<SportBookingBreakdownDto> {
    if (!sport?.trim()) {
      throw new BadRequestException('Query parameter "sport" is required');
    }
    return this.adminService.getSportBookingBreakdown(sport);
  }

  @Get("metrics/by-sport/drilldown")
  @UseGuards(JwtAuthGuard, AdminRoleGuard)
  @ApiBearerAuth("JWT")
  @ApiOperation({
    summary:
      "Paginated distinct bookers for one slice of the sport breakdown (same 14-day window)",
  })
  getSportDrilldown(
    @Query("sport") sport: string,
    @Query("dimension") dimension: string,
    @Query("value") value: string,
    @Query("page", new DefaultValuePipe(0), ParseIntPipe) page: number,
    @Query("pageSize", new DefaultValuePipe(40), ParseIntPipe) pageSize: number,
  ): Promise<SportBreakdownDrilldownPageDto> {
    if (!sport?.trim() || !dimension?.trim() || !value?.trim()) {
      throw new BadRequestException("sport, dimension, and value are required");
    }
    return this.adminService.getSportBreakdownDrilldown(
      sport,
      dimension,
      value,
      page,
      pageSize,
    );
  }

  @Get("metrics/kpi-drilldown")
  @UseGuards(JwtAuthGuard, AdminRoleGuard)
  @ApiBearerAuth("JWT")
  @ApiOperation({ summary: "Paginated rows behind a dashboard KPI tile" })
  getKpiDrilldown(
    @Query("metric") metric: string,
    @Query("page", new DefaultValuePipe(0), ParseIntPipe) page: number,
    @Query("pageSize", new DefaultValuePipe(40), ParseIntPipe) pageSize: number,
  ): Promise<KpiDrilldownPageDto> {
    if (!metric?.trim()) {
      throw new BadRequestException('Query parameter "metric" is required');
    }
    return this.adminService.getKpiDrilldown(metric, page, pageSize);
  }

  @Get("metrics/day-bookings")
  @UseGuards(JwtAuthGuard, AdminRoleGuard)
  @ApiBearerAuth("JWT")
  @ApiOperation({
    summary: "Court bookings on a single calendar day (non-cancelled), paginated",
  })
  getDayBookings(
    @Query("date") date: string,
    @Query("page", new DefaultValuePipe(0), ParseIntPipe) page: number,
    @Query("pageSize", new DefaultValuePipe(40), ParseIntPipe) pageSize: number,
  ): Promise<DayBookingDrilldownPageDto> {
    if (!date?.trim()) {
      throw new BadRequestException('Query parameter "date" is required');
    }
    return this.adminService.getDayCourtBookingsDrilldown(date, page, pageSize);
  }
}
