import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { RolesModule } from "../roles/roles.module";
import { OrganizationsModule } from "../organizations/organizations.module";
import { BranchesModule } from "../branches/branches.module";
import { LocationsModule } from "../locations/locations.module";
import { CourtsModule } from "../courts/courts.module";
import { Sport } from "../sports/entities/sport.entity";
import { User } from "../users/entities/user.entity";
import { Coach } from "../coaches/entities/coach.entity";
import { LocationBookingWindow } from "../locations/entities/location-booking-window.entity";
import { UserLocationMembership } from "../memberships/entities/user-location-membership.entity";
import { MembershipTransaction } from "../memberships/entities/membership-transaction.entity";
import { CourtBooking } from "../bookings/entities/court-booking.entity";
import { SeedService } from "./seed.service";

@Module({
  imports: [
    RolesModule,
    OrganizationsModule,
    BranchesModule,
    LocationsModule,
    CourtsModule,
    TypeOrmModule.forFeature([
      Sport,
      User,
      Coach,
      LocationBookingWindow,
      UserLocationMembership,
      MembershipTransaction,
      CourtBooking,
    ]),
  ],
  providers: [SeedService],
  exports: [],
})
export class DatabaseModule {}
