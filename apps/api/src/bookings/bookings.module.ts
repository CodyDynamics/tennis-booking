import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { CourtBooking } from "./entities/court-booking.entity";
import { CoachSession } from "./entities/coach-session.entity";
import { CourtBookingHandler } from "./handlers/court-booking.handler";
import { CoachSessionHandler } from "./handlers/coach-session.handler";
import { BookingsService } from "./bookings.service";
import { BookingsController } from "./bookings.controller";
import { CourtsModule } from "../courts/courts.module";
import { CoachesModule } from "../coaches/coaches.module";
import { UserLocationMembership } from "../memberships/entities/user-location-membership.entity";

@Module({
  imports: [
    TypeOrmModule.forFeature([CourtBooking, CoachSession, UserLocationMembership]),
    CourtsModule,
    CoachesModule,
  ],
  controllers: [BookingsController],
  providers: [CourtBookingHandler, CoachSessionHandler, BookingsService],
  exports: [BookingsService],
})
export class BookingsModule {}
