import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { Role } from "../auth/entities/role.entity";
import { SeedService } from "./seed.service";

@Module({
  imports: [TypeOrmModule.forFeature([Role])],
  providers: [SeedService],
  exports: [],
})
export class DatabaseModule {}
