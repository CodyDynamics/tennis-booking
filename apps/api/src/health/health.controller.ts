import { Controller, Get } from "@nestjs/common";
import { ApiTags, ApiOperation, ApiResponse } from "@nestjs/swagger";
import { Public } from "@app/common";
import { DataSource } from "typeorm";

@ApiTags("Health")
@Controller("health")
export class HealthController {
  constructor(private dataSource: DataSource) {}

  @Get()
  @Public()
  @ApiOperation({ summary: "Health check (API and DB connection)" })
  @ApiResponse({
    status: 200,
    description: "OK",
    schema: {
      type: "object",
      properties: {
        status: { type: "string", example: "ok" },
        timestamp: { type: "string", example: "2024-01-01T00:00:00.000Z" },
        service: { type: "string", example: "api" },
      },
    },
  })
  @ApiResponse({
    status: 200,
    description: "Error (DB connection failed)",
    schema: {
      type: "object",
      properties: {
        status: { type: "string", example: "error" },
        timestamp: { type: "string" },
        service: { type: "string" },
        error: { type: "string" },
      },
    },
  })
  async check() {
    try {
      await this.dataSource.query("SELECT 1");
      return {
        status: "ok",
        timestamp: new Date().toISOString(),
        service: "api",
      };
    } catch (error) {
      return {
        status: "error",
        timestamp: new Date().toISOString(),
        service: "api",
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }
}
