import { Controller, Get, UseGuards } from "@nestjs/common";
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from "@nestjs/swagger";
import { JwtAuthGuard } from "@app/common";
import { AdminRoleGuard } from "./admin-role.guard";
import { AdminService, DashboardMetricsDto } from "./admin.service";

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
}
