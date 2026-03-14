import { Controller, Get, UseGuards } from "@nestjs/common";
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from "@nestjs/swagger";
import { JwtAuthGuard } from "@app/common";
import { CurrentUser } from "@app/common";
import { UsersService } from "./users.service";

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
}
