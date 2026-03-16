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
import { UpdateUserDto } from "./dto/update-user.dto";

@ApiTags("Users")
@ApiBearerAuth("JWT")
@Controller("users")
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get("profile")
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: "Get current user profile" })
  @ApiResponse({ status: 200, description: "User info (id, email, fullName, role, ...)" })
  @ApiResponse({ status: 401, description: "Unauthorized" })
  async getProfile(@CurrentUser() user: { id: string }) {
    return this.usersService.findOne(user.id);
  }

  @Get()
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermission("users:view")
  @ApiOperation({ summary: "List users (admin)" })
  @ApiQuery({ name: "roleId", required: false })
  @ApiQuery({ name: "search", required: false })
  @ApiResponse({ status: 200, description: "Array of users" })
  async findAll(
    @Query("roleId") roleId?: string,
    @Query("search") search?: string,
  ) {
    return this.usersService.findAll(roleId, search);
  }

  @Get(":id")
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermission("users:view")
  @ApiOperation({ summary: "Get user by id" })
  @ApiParam({ name: "id" })
  @ApiResponse({ status: 200 })
  @ApiResponse({ status: 404, description: "User not found" })
  async findOne(@Param("id") id: string) {
    return this.usersService.findOne(id);
  }

  @Post()
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermission("users:create")
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: "Create user (admin)" })
  @ApiBody({ type: CreateUserDto })
  @ApiResponse({ status: 201 })
  @ApiResponse({ status: 400, description: "Email already exists" })
  async create(@Body() dto: CreateUserDto) {
    return this.usersService.create(dto);
  }

  @Patch(":id")
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermission("users:update")
  @ApiOperation({ summary: "Update user (admin)" })
  @ApiParam({ name: "id" })
  @ApiBody({ type: UpdateUserDto })
  @ApiResponse({ status: 200 })
  @ApiResponse({ status: 404 })
  async update(@Param("id") id: string, @Body() dto: UpdateUserDto) {
    return this.usersService.update(id, dto);
  }

  @Delete(":id")
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermission("users:delete")
  @ApiOperation({ summary: "Delete user (admin)" })
  @ApiParam({ name: "id" })
  @ApiResponse({ status: 200, description: "Deleted" })
  @ApiResponse({ status: 404 })
  async remove(@Param("id") id: string) {
    return this.usersService.remove(id);
  }
}
