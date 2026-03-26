import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from "@nestjs/common";
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from "@nestjs/swagger";
import { SportsService } from "./sports.service";
import { CreateSportDto } from "./dto/create-sport.dto";
import { UpdateSportDto } from "./dto/update-sport.dto";
import { JwtAuthGuard, PermissionsGuard, RequirePermission } from "@app/common";

@ApiTags("Sports")
@Controller("sports")
export class SportsController {
  constructor(private readonly sportsService: SportsService) {}

  @Get()
  @ApiOperation({ summary: "List all sports (for dynamic sport selector)" })
  @ApiResponse({ status: 200, description: "Array of sports" })
  findAll() {
    return this.sportsService.findAll();
  }

  @Post()
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermission("sports:create")
  @ApiBearerAuth("JWT")
  @ApiOperation({ summary: "Create sport" })
  create(@Body() dto: CreateSportDto) {
    return this.sportsService.create(dto);
  }

  @Patch(":id")
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermission("sports:update")
  @ApiBearerAuth("JWT")
  @ApiOperation({ summary: "Update sport" })
  update(@Param("id") id: string, @Body() dto: UpdateSportDto) {
    return this.sportsService.update(id, dto);
  }

  @Delete(":id")
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermission("sports:delete")
  @ApiBearerAuth("JWT")
  @ApiOperation({ summary: "Delete sport" })
  remove(@Param("id") id: string) {
    return this.sportsService.remove(id);
  }
}
