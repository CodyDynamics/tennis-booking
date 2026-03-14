import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { RolesModule } from "../roles/roles.module";
import { SeedService } from "./seed.service";

@Module({
  imports: [RolesModule],
  providers: [SeedService],
  exports: [],
})
export class DatabaseModule {}
