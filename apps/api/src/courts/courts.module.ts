import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { Court } from "./entities/court.entity";
import { Coach } from "../coaches/entities/coach.entity";
import { LocationBookingWindow } from "../locations/entities/location-booking-window.entity";
import { CourtsService } from "./courts.service";
import { CourtsController } from "./courts.controller";

@Module({
  imports: [TypeOrmModule.forFeature([Court, Coach, LocationBookingWindow])],
  controllers: [CourtsController],
  providers: [CourtsService],
  exports: [CourtsService, TypeOrmModule],
})
export class CourtsModule {}
