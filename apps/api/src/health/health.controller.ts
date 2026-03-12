import { Controller, Get } from "@nestjs/common";
import { Public } from "@app/common";
import { DataSource } from "typeorm";

@Controller("health")
export class HealthController {
  constructor(private dataSource: DataSource) {}

  @Get()
  @Public()
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
