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
  HttpCode,
  HttpStatus,
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
import { JwtAuthGuard, PermissionsGuard, RequirePermission } from "@app/common";
import { CurrentUser } from "@app/common";
import { UsersService } from "./users.service";
import { CreateUserDto } from "./dto/create-user.dto";
import { CreateMembershipPlaceholderDto } from "./dto/create-membership-placeholder.dto";
import { UpdateUserDto } from "./dto/update-user.dto";

@ApiTags("Users")
@ApiBearerAuth("JWT")
@Controller("users")
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get("profile")
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: "Get current user profile" })
  @ApiResponse({
    status: 200,
    description: "User info (id, email, fullName, role, ...)",
  })
  @ApiResponse({ status: 401, description: "Unauthorized" })
  async getProfile(@CurrentUser() user: { id: string }) {
    return this.usersService.findOne(user.id, true);
  }

  @Get()
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermission("users:view")
  @ApiOperation({ summary: "List users (admin)" })
  @ApiQuery({ name: "roleId", required: false })
  @ApiQuery({ name: "search", required: false })
  @ApiQuery({ name: "onlyMembership", required: false, type: Boolean })
  @ApiQuery({
    name: "noMembershipAtLocationId",
    required: false,
    description:
      "Users with no active/pending membership at this location (onboarding / Area form). super_user must operate this location.",
  })
  @ApiQuery({
    name: "forAreaAssignment",
    required: false,
    type: Boolean,
    description:
      "Area form: broad list — super_admin sees all users; super_user sees venue members plus accounts with no membership yet (e.g. public registrants).",
  })
  @ApiQuery({
    name: "noMembershipAnywhere",
    required: false,
    type: Boolean,
    description:
      "super_admin only: users with no rows in user_location_memberships (e.g. self-registered, not yet on any venue).",
  })
  @ApiQuery({
    name: "membershipAtLocationId",
    required: false,
    description:
      "Only users with a membership row at this location (child venue). super_admin/admin; super_user must own this location.",
  })
  @ApiQuery({
    name: "areaId",
    required: false,
    description:
      "Same as filtering by that area's locationId (membership at parent location child).",
  })
  @ApiQuery({
    name: "accountType",
    required: false,
    description: "Filter by user.accountType: system | normal | membership",
  })
  @ApiQuery({
    name: "excludeAccountType",
    required: false,
    description:
      "Exclude this accountType (e.g. membership) — useful for the main Users list without placeholders.",
  })
  @ApiQuery({
    name: "includeMemberships",
    required: false,
    type: Boolean,
    description:
      "When true, each user includes `memberships` (id, locationId, status) for admin tables.",
  })
  @ApiResponse({ status: 200, description: "Array of users" })
  async findAll(
    @CurrentUser() requester: { id: string; role?: string | null },
    @Query("roleId") roleId?: string,
    @Query("search") search?: string,
    @Query("onlyMembership") onlyMembership?: string,
    @Query("noMembershipAtLocationId") noMembershipAtLocationId?: string,
    @Query("forAreaAssignment") forAreaAssignment?: string,
    @Query("noMembershipAnywhere") noMembershipAnywhere?: string,
    @Query("membershipAtLocationId") membershipAtLocationId?: string,
    @Query("areaId") areaId?: string,
    @Query("accountType") accountType?: string,
    @Query("excludeAccountType") excludeAccountType?: string,
    @Query("includeMemberships") includeMemberships?: string,
  ) {
    return this.usersService.findAll(
      roleId,
      search,
      onlyMembership === "true" || onlyMembership === "1",
      noMembershipAtLocationId?.trim() || undefined,
      forAreaAssignment === "true" || forAreaAssignment === "1",
      noMembershipAnywhere === "true" || noMembershipAnywhere === "1",
      membershipAtLocationId?.trim() || undefined,
      areaId?.trim() || undefined,
      accountType?.trim() || undefined,
      excludeAccountType?.trim() || undefined,
      includeMemberships === "true" || includeMemberships === "1",
      { id: requester.id, role: requester.role ?? null },
    );
  }

  @Get("venue-memberships")
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermission("users:view")
  @ApiOperation({
    summary:
      "List all user memberships at child locations (super_admin Locations page table)",
  })
  @ApiResponse({ status: 200 })
  @ApiResponse({ status: 403 })
  async venueMembershipAssignments(
    @CurrentUser() requester: { id: string; role?: string | null },
  ) {
    return this.usersService.findVenueMembershipAssignments({
      id: requester.id,
      role: requester.role ?? null,
    });
  }

  @Get(":id")
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermission("users:view")
  @ApiOperation({ summary: "Get user by id" })
  @ApiParam({ name: "id" })
  @ApiQuery({ name: "includeMemberships", required: false, type: Boolean })
  @ApiResponse({ status: 200 })
  @ApiResponse({ status: 404, description: "User not found" })
  async findOne(
    @CurrentUser() requester: { id: string; role?: string | null },
    @Param("id") id: string,
    @Query("includeMemberships") includeMemberships?: string,
  ) {
    return this.usersService.findOne(
      id,
      includeMemberships === "true" || includeMemberships === "1",
      { id: requester.id, role: requester.role ?? null },
    );
  }

  @Post("membership-placeholder")
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermission("users:create")
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary:
      "Pre-add membership user (email + phone, no password; user completes signup via /register)",
  })
  @ApiBody({ type: CreateMembershipPlaceholderDto })
  @ApiResponse({ status: 201 })
  async createMembershipPlaceholder(
    @Body() dto: CreateMembershipPlaceholderDto,
    @CurrentUser() requester: { id: string; role?: string | null },
  ) {
    return this.usersService.createMembershipPlaceholder(dto, {
      id: requester.id,
      role: requester.role ?? null,
    });
  }

  @Post()
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermission("users:create")
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: "Create user (admin)" })
  @ApiBody({ type: CreateUserDto })
  @ApiResponse({ status: 201 })
  @ApiResponse({ status: 400, description: "Email already exists" })
  async create(
    @Body() dto: CreateUserDto,
    @CurrentUser() requester: { id: string; role?: string | null },
  ) {
    return this.usersService.create(dto, {
      id: requester.id,
      role: requester.role ?? null,
    });
  }

  @Patch(":id")
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermission("users:update")
  @ApiOperation({ summary: "Update user (admin)" })
  @ApiParam({ name: "id" })
  @ApiBody({ type: UpdateUserDto })
  @ApiResponse({ status: 200 })
  @ApiResponse({ status: 404 })
  async update(
    @Param("id") id: string,
    @Body() dto: UpdateUserDto,
    @CurrentUser() requester: { id: string; role?: string | null },
  ) {
    return this.usersService.update(id, dto, {
      id: requester.id,
      role: requester.role ?? null,
    });
  }

  @Delete(":id")
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermission("users:delete")
  @ApiOperation({ summary: "Delete user (admin)" })
  @ApiParam({ name: "id" })
  @ApiResponse({ status: 200, description: "Deleted" })
  @ApiResponse({ status: 404 })
  async remove(
    @Param("id") id: string,
    @CurrentUser() requester: { id: string; role?: string | null },
  ) {
    return this.usersService.remove(id, {
      id: requester.id,
      role: requester.role ?? null,
    });
  }
}
