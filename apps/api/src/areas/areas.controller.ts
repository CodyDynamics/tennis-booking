import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from "@nestjs/common";
import {
  ApiBearerAuth,
  ApiOperation,
  ApiQuery,
  ApiTags,
} from "@nestjs/swagger";
import {
  CurrentUser,
  JwtAuthGuard,
  PermissionsGuard,
  RequirePermission,
} from "@app/common";
import { AreasService } from "./areas.service";
import { CreateAreaDto } from "./dto/create-area.dto";
import { UpdateAreaDto } from "./dto/update-area.dto";

@ApiTags("Areas")
@Controller("areas")
export class AreasController {
  constructor(private readonly areasService: AreasService) {}

  @Post()
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermission("areas:create")
  @ApiBearerAuth("JWT")
  @ApiOperation({ summary: "Create area under location child" })
  create(@Body() dto: CreateAreaDto) {
    return this.areasService.create(dto);
  }

  @Get()
  @ApiOperation({ summary: "List areas" })
  @ApiQuery({ name: "locationId", required: false })
  findAll(@Query("locationId") locationId?: string) {
    return this.areasService.findAll(locationId);
  }

  @Get("bookable")
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth("JWT")
  @ApiOperation({
    summary: "Areas user can reserve (public + private in membership locations)",
  })
  findBookable(@CurrentUser() user: { id: string }) {
    return this.areasService.findBookableForUser(user.id);
  }

  @Get(":id")
  findOne(@Param("id") id: string) {
    return this.areasService.findOne(id);
  }

  @Patch(":id")
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermission("areas:update")
  @ApiBearerAuth("JWT")
  update(@Param("id") id: string, @Body() dto: UpdateAreaDto) {
    return this.areasService.update(id, dto);
  }

  @Delete(":id")
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermission("areas:delete")
  @ApiBearerAuth("JWT")
  remove(@Param("id") id: string) {
    return this.areasService.remove(id);
  }
}
