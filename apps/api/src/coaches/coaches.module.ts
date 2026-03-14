import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { Coach } from "./entities/coach.entity";
import { CoachesService } from "./coaches.service";
import { CoachesController } from "./coaches.controller";

@Module({
  imports: [TypeOrmModule.forFeature([Coach])],
  controllers: [CoachesController],
  providers: [CoachesService],
  exports: [CoachesService],
})
export class CoachesModule {}
