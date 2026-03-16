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
import { BranchesService } from "./branches.service";
import { CreateBranchDto } from "./dto/create-branch.dto";
import { UpdateBranchDto } from "./dto/update-branch.dto";
import { JwtAuthGuard, PermissionsGuard, RequirePermission } from "@app/common";

@ApiTags("Branches")
@Controller("branches")
export class BranchesController {
  constructor(private readonly branchesService: BranchesService) {}

  @Post()
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermission("branches:create")
  @ApiBearerAuth("JWT")
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: "Create branch" })
  @ApiBody({ type: CreateBranchDto })
  @ApiResponse({ status: 201, description: "Branch created" })
  @ApiResponse({ status: 400, description: "Invalid data" })
  create(@Body() dto: CreateBranchDto) {
    return this.branchesService.create(dto);
  }

  @Get()
  @ApiOperation({ summary: "List branches (optional filter by organizationId)" })
  @ApiQuery({ name: "organizationId", required: false })
  @ApiResponse({ status: 200, description: "Array of branches" })
  findAll(@Query("organizationId") organizationId?: string) {
    return this.branchesService.findAll(organizationId);
  }

  @Get(":id")
  @ApiOperation({ summary: "Get branch by id" })
  @ApiParam({ name: "id", description: "Branch UUID" })
  @ApiResponse({ status: 200, description: "Branch details" })
  @ApiResponse({ status: 404, description: "Branch not found" })
  findOne(@Param("id") id: string) {
    return this.branchesService.findOne(id);
  }

  @Patch(":id")
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermission("branches:update")
  @ApiBearerAuth("JWT")
  @ApiOperation({ summary: "Update branch" })
  @ApiParam({ name: "id" })
  @ApiBody({ type: UpdateBranchDto })
  @ApiResponse({ status: 200, description: "Update successful" })
  @ApiResponse({ status: 404, description: "Branch not found" })
  update(@Param("id") id: string, @Body() dto: UpdateBranchDto) {
    return this.branchesService.update(id, dto);
  }

  @Delete(":id")
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermission("branches:delete")
  @ApiBearerAuth("JWT")
  @ApiOperation({ summary: "Delete branch" })
  @ApiParam({ name: "id" })
  @ApiResponse({ status: 200, description: "Delete successful" })
  @ApiResponse({ status: 404, description: "Branch not found" })
  remove(@Param("id") id: string) {
    return this.branchesService.remove(id);
  }
}
