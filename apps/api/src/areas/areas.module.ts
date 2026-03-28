import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { Area } from "./entities/area.entity";
import { AreasService } from "./areas.service";
import { AreasController } from "./areas.controller";
import { User } from "../users/entities/user.entity";
import { LocationsModule } from "../locations/locations.module";

@Module({
  imports: [
    TypeOrmModule.forFeature([Area, User]),
    LocationsModule,
  ],
  providers: [AreasService],
  controllers: [AreasController],
  exports: [AreasService, TypeOrmModule],
})
export class AreasModule {}
