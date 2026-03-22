import { Injectable, NotFoundException } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Brackets, Repository } from "typeorm";
import { buildListResponse, ListResponse } from "@app/common";
import { Location } from "./entities/location.entity";
import { LocationVisibility } from "./entities/location.enums";
import { MembershipStatus } from "../memberships/entities/membership.enums";
import { CreateLocationDto } from "./dto/create-location.dto";
import { UpdateLocationDto } from "./dto/update-location.dto";
import { UserLocationMembership } from "../memberships/entities/user-location-membership.entity";

export interface LocationMembershipStatusDto {
  locationId: string;
  visibility: LocationVisibility;
  hasActiveMembership: boolean;
  membershipStatus: MembershipStatus | null;
}

@Injectable()
export class LocationsService {
  constructor(
    @InjectRepository(Location)
    private locationRepo: Repository<Location>,
    @InjectRepository(UserLocationMembership)
    private membershipRepo: Repository<UserLocationMembership>,
  ) {}

  async create(dto: CreateLocationDto) {
    return this.locationRepo.save(this.locationRepo.create(dto));
  }

  async findAll(
    branchId?: string,
    pageIndex = 0,
    pageSize = 200,
  ): Promise<ListResponse<Location>> {
    const qb = this.locationRepo
      .createQueryBuilder("location")
      .orderBy("location.name", "ASC");
    if (branchId) {
      qb.andWhere("location.branchId = :branchId", { branchId });
    }
    const safePage = Math.max(0, pageIndex);
    const safeSize = Math.min(500, Math.max(1, pageSize));
    const total = await qb.clone().getCount();
    const data = await qb
      .skip(safePage * safeSize)
      .take(safeSize)
      .getMany();
    return buildListResponse(data, total, safePage, safeSize);
  }

  /**
   * Active locations visible to everyone (maps, marketing). Excludes private clubs.
   */
  async findPublicActive(
    pageIndex = 0,
    pageSize = 500,
  ): Promise<ListResponse<Location>> {
    const qb = this.locationRepo
      .createQueryBuilder("loc")
      .where("loc.visibility = :vis", { vis: LocationVisibility.PUBLIC })
      .andWhere("loc.status = :status", { status: "active" })
      .orderBy("loc.name", "ASC");
    const safePage = Math.max(0, pageIndex);
    const safeSize = Math.min(500, Math.max(1, pageSize));
    const total = await qb.clone().getCount();
    const data = await qb
      .skip(safePage * safeSize)
      .take(safeSize)
      .getMany();
    return buildListResponse(data, total, safePage, safeSize);
  }

  /**
   * Locations the user may book: all active public + active private where they have an active membership.
   */
  async findBookableForUser(userId: string): Promise<Location[]> {
    return this.locationRepo
      .createQueryBuilder("loc")
      .where("loc.status = :status", { status: "active" })
      .andWhere(
        new Brackets((qb) => {
          qb.where("loc.visibility = :pub", {
            pub: LocationVisibility.PUBLIC,
          }).orWhere(
            `loc.visibility = :priv AND EXISTS (
              SELECT 1 FROM user_location_memberships m
              WHERE m."locationId" = loc.id AND m."userId" = :userId AND m.status = :mstat
            )`,
            {
              priv: LocationVisibility.PRIVATE,
              userId,
              mstat: MembershipStatus.ACTIVE,
            },
          );
        }),
      )
      .orderBy("loc.name", "ASC")
      .getMany();
  }

  async findOne(id: string) {
    const location = await this.locationRepo.findOne({ where: { id } });
    if (!location) throw new NotFoundException("Location not found");
    return location;
  }

  /**
   * Current user's membership at this location (JWT). Public locations still return visibility;
   * hasActiveMembership is only required for private booking flows.
   */
  async getMembershipForUser(
    locationId: string,
    userId: string,
  ): Promise<LocationMembershipStatusDto> {
    const location = await this.findOne(locationId);
    const membership = await this.membershipRepo.findOne({
      where: { locationId, userId },
    });
    const active = membership?.status === MembershipStatus.ACTIVE;
    return {
      locationId: location.id,
      visibility: location.visibility,
      hasActiveMembership: active,
      membershipStatus: membership?.status ?? null,
    };
  }

  async update(id: string, dto: UpdateLocationDto) {
    await this.findOne(id);
    await this.locationRepo.update(id, dto);
    return this.findOne(id);
  }

  async remove(id: string) {
    await this.findOne(id);
    await this.locationRepo.delete(id);
    return { deleted: true };
  }
}
