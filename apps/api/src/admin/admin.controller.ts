import {
  BadRequestException,
  Controller,
  Get,
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
  SportBookingBreakdownDto,
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
}
