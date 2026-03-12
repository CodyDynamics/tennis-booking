import { Controller, Get, UseGuards } from "@nestjs/common";
import { JwtAuthGuard } from "@app/common";
import { CurrentUser } from "@app/common";
import { UsersService } from "./users.service";

@Controller("users")
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get("profile")
  @UseGuards(JwtAuthGuard)
  async getProfile(@CurrentUser() user: any) {
    return this.usersService.findOne(user.id);
  }
}
