import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { CourtBooking } from "./entities/court-booking.entity";
import { CoachSession } from "./entities/coach-session.entity";
import { BookingCommand } from "./entities/booking-command.entity";
import { CourtBookingHandler } from "./handlers/court-booking.handler";
import { CoachSessionHandler } from "./handlers/coach-session.handler";
import { BookingsService } from "./bookings.service";
import { BookingsController } from "./bookings.controller";
import { CourtWizardAvailabilityService } from "./court-wizard-availability.service";
import { CourtHoldGateway } from "./court-hold.gateway";
import { CourtsModule } from "../courts/courts.module";
import { CoachesModule } from "../coaches/coaches.module";
import { Location } from "../locations/entities/location.entity";
import { LocationBookingWindow } from "../locations/entities/location-booking-window.entity";
import { Court } from "../courts/entities/court.entity";
import { NotificationsModule } from "../notifications/notifications.module";
import { Area } from "../areas/entities/area.entity";
import { LocationsModule } from "../locations/locations.module";

@Module({
  imports: [
    TypeOrmModule.forFeature([
      CourtBooking,
      CoachSession,
      BookingCommand,
      Location,
      LocationBookingWindow,
      Court,
      Area,
    ]),
    CourtsModule,
    CoachesModule,
    NotificationsModule,
    LocationsModule,
  ],
  controllers: [BookingsController],
  providers: [
    CourtBookingHandler,
    CoachSessionHandler,
    CourtWizardAvailabilityService,
    BookingsService,
    CourtHoldGateway,
  ],
  exports: [BookingsService, CourtHoldGateway],
})
export class BookingsModule {}
