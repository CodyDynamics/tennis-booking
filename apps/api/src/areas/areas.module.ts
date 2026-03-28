import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { Area } from "./entities/area.entity";
import { AreasService } from "./areas.service";
import { AreasController } from "./areas.controller";
import { UserLocationMembership } from "../memberships/entities/user-location-membership.entity";
import { User } from "../users/entities/user.entity";

@Module({
  imports: [TypeOrmModule.forFeature([Area, UserLocationMembership, User])],
  providers: [AreasService],
  controllers: [AreasController],
  exports: [AreasService, TypeOrmModule],
})
export class AreasModule {}
