import { Controller, Get, Patch, Param, Body, UseGuards } from "@nestjs/common";
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiParam, ApiBody } from "@nestjs/swagger";
import { Public } from "@app/common";
import { JwtAuthGuard, PermissionsGuard, RequirePermission } from "@app/common";
import { RolesService } from "./roles.service";
import { UpdateRolePermissionsDto } from "./dto/update-role-permissions.dto";
import { PERMISSION_RESOURCES } from "./permissions.constants";

@ApiTags("Roles")
@Controller("roles")
export class RolesController {
  constructor(private readonly rolesService: RolesService) {}

  @Get()
  @Public()
  @ApiOperation({ summary: "List all roles (for registration)" })
  @ApiResponse({ status: 200, description: "Array of roles (id, name, permissions)" })
  findAll() {
    return this.rolesService.findAll();
  }

  @Get("permissions/schema")
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermission("roles:view")
  @ApiBearerAuth("JWT")
  @ApiOperation({ summary: "Get permission schema (resources and actions for RBAC)" })
  @ApiResponse({ status: 200, description: "List of resources with their actions" })
  getPermissionsSchema() {
    return PERMISSION_RESOURCES;
  }

  @Get(":id")
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermission("roles:view")
  @ApiBearerAuth("JWT")
  @ApiOperation({ summary: "Get role by id" })
  @ApiParam({ name: "id" })
  @ApiResponse({ status: 200 })
  findOne(@Param("id") id: string) {
    return this.rolesService.findOne(id);
  }

  @Patch(":id/permissions")
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermission("roles:update")
  @ApiBearerAuth("JWT")
  @ApiOperation({ summary: "Update role permissions (RBAC)" })
  @ApiParam({ name: "id" })
  @ApiBody({ type: UpdateRolePermissionsDto })
  @ApiResponse({ status: 200 })
  updatePermissions(
    @Param("id") id: string,
    @Body() dto: UpdateRolePermissionsDto,
  ) {
    return this.rolesService.updatePermissions(id, dto.permissions);
  }
}
