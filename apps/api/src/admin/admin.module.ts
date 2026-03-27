import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { User } from "../users/entities/user.entity";
import { Court } from "../courts/entities/court.entity";
import { Location } from "../locations/entities/location.entity";
import { CourtBooking } from "../bookings/entities/court-booking.entity";
import { CoachSession } from "../bookings/entities/coach-session.entity";
import { Coach } from "../coaches/entities/coach.entity";
import { AdminController } from "./admin.controller";
import { AdminService } from "./admin.service";
import { AdminRoleGuard } from "./admin-role.guard";

@Module({
  imports: [
    TypeOrmModule.forFeature([
      User,
      Court,
      Location,
      CourtBooking,
      CoachSession,
      Coach,
    ]),
  ],
  controllers: [AdminController],
  providers: [AdminService, AdminRoleGuard],
})
export class AdminModule {}
