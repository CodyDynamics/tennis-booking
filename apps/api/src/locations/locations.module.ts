import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { LocationsService } from './locations.service';
import { LocationsController } from './locations.controller';
import { Location } from './entities/location.entity';
import { UserLocationMembership } from '../memberships/entities/user-location-membership.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Location, UserLocationMembership])],
  controllers: [LocationsController],
  providers: [LocationsService],
  exports: [LocationsService, TypeOrmModule],
})
export class LocationsModule {}
