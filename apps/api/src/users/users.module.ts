import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { UsersService } from "./users.service";
import { UsersController } from "./users.controller";
import { User } from "./entities/user.entity";
import { RolesModule } from "../roles/roles.module";
import { UserLocationMembership } from "../memberships/entities/user-location-membership.entity";
import { Location } from "../locations/entities/location.entity";

@Module({
  imports: [RolesModule, TypeOrmModule.forFeature([User, UserLocationMembership, Location])],
  controllers: [UsersController],
  providers: [UsersService],
  exports: [TypeOrmModule],
})
export class UsersModule {}
