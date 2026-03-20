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
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiQuery, ApiBearerAuth } from '@nestjs/swagger';
import { LocationsService } from './locations.service';
import { CreateLocationDto } from './dto/create-location.dto';
import { UpdateLocationDto } from './dto/update-location.dto';
import { JwtAuthGuard, PermissionsGuard, RequirePermission } from '@app/common';

@ApiTags('Locations')
@Controller('locations')
export class LocationsController {
  constructor(private readonly locationsService: LocationsService) {}

  @Post()
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermission("locations:create")
  @ApiBearerAuth("JWT")
  @ApiOperation({ summary: 'Create location' })
  create(@Body() createLocationDto: CreateLocationDto) {
    return this.locationsService.create(createLocationDto);
  }

  @Get()
  @ApiOperation({ summary: "List locations (paginated)" })
  @ApiQuery({ name: "branchId", required: false })
  @ApiQuery({ name: "page", required: false })
  @ApiQuery({ name: "pageSize", required: false })
  findAll(
    @Query("branchId") branchId?: string,
    @Query("page") page?: string,
    @Query("pageSize") pageSize?: string,
  ) {
    const pageIndex = Math.max(0, parseInt(page ?? "0", 10) || 0);
    const size = Math.min(
      500,
      Math.max(1, parseInt(pageSize ?? "200", 10) || 200),
    );
    return this.locationsService.findAll(branchId, pageIndex, size);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get location by id' })
  findOne(@Param('id') id: string) {
    return this.locationsService.findOne(id);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermission("locations:update")
  @ApiBearerAuth("JWT")
  @ApiOperation({ summary: 'Update location' })
  update(@Param('id') id: string, @Body() updateLocationDto: UpdateLocationDto) {
    return this.locationsService.update(id, updateLocationDto);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermission("locations:delete")
  @ApiBearerAuth("JWT")
  @ApiOperation({ summary: 'Delete location' })
  remove(@Param('id') id: string) {
    return this.locationsService.remove(id);
  }
}
