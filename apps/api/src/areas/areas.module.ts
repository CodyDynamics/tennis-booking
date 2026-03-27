import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { Area } from "./entities/area.entity";
import { AreasService } from "./areas.service";
import { AreasController } from "./areas.controller";
import { UserLocationMembership } from "../memberships/entities/user-location-membership.entity";

@Module({
  imports: [TypeOrmModule.forFeature([Area, UserLocationMembership])],
  providers: [AreasService],
  controllers: [AreasController],
  exports: [AreasService, TypeOrmModule],
})
export class AreasModule {}
