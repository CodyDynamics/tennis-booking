import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { Sport } from "./entities/sport.entity";
import { SportsController } from "./sports.controller";
import { SportsService } from "./sports.service";

@Module({
  imports: [TypeOrmModule.forFeature([Sport])],
  controllers: [SportsController],
  providers: [SportsService],
  exports: [SportsService],
})
export class SportsModule {}
