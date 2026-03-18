import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { RolesModule } from "../roles/roles.module";
import { OrganizationsModule } from "../organizations/organizations.module";
import { BranchesModule } from "../branches/branches.module";
import { LocationsModule } from "../locations/locations.module";
import { CourtsModule } from "../courts/courts.module";
import { Sport } from "../sports/entities/sport.entity";
import { SeedService } from "./seed.service";

@Module({
  imports: [
    RolesModule,
    OrganizationsModule,
    BranchesModule,
    LocationsModule,
    CourtsModule,
    TypeOrmModule.forFeature([Sport]),
  ],
  providers: [SeedService],
  exports: [],
})
export class DatabaseModule {}
