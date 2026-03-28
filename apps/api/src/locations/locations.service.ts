import { Injectable, NotFoundException } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Brackets, In, Repository } from "typeorm";
import { buildListResponse, ListResponse } from "@app/common";
import { Location } from "./entities/location.entity";
import { LocationKind } from "./entities/location-kind.enum";
import { LocationVisibility } from "./entities/location.enums";
import { MembershipStatus } from "../memberships/entities/membership.enums";
import { CreateLocationDto } from "./dto/create-location.dto";
import { UpdateLocationDto } from "./dto/update-location.dto";
import { UserLocationMembership } from "../memberships/entities/user-location-membership.entity";
import { User } from "../users/entities/user.entity";

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
    @InjectRepository(User)
    private userRepo: Repository<User>,
  ) {}

  async create(dto: CreateLocationDto) {
    return this.locationRepo.save(this.locationRepo.create(dto));
  }

  async findAll(
    branchId?: string,
    parentLocationId?: string,
    kind?: string,
    pageIndex = 0,
    pageSize = 200,
  ): Promise<ListResponse<Location>> {
    const qb = this.locationRepo
      .createQueryBuilder("location")
      .orderBy("location.name", "ASC");
    if (branchId) {
      qb.andWhere("location.branchId = :branchId", { branchId });
    }
    if (parentLocationId) {
      qb.andWhere("location.parentLocationId = :parentLocationId", {
        parentLocationId,
      });
    }
    if (kind) {
      qb.andWhere("location.kind = :kind", { kind });
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
      .where("loc.kind = :kind", { kind: LocationKind.CHILD })
      .andWhere("loc.visibility = :vis", { vis: LocationVisibility.PUBLIC })
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
   * - super_admin: all active child locations (public + private).
   * - User with eligible membership: those locations only.
   * - No membership: none (must be assigned before booking).
   */
  async findBookableForUser(userId: string): Promise<Location[]> {
    const user = await this.userRepo.findOne({
      where: { id: userId },
      relations: ["role"],
    });
    if (user?.role?.name === "super_admin") {
      return this.locationRepo.find({
        where: { kind: LocationKind.CHILD, status: "active" },
        order: { name: "ASC" },
      });
    }

    const memberships = await this.membershipRepo.find({
      where: { userId },
    });
    const memberLocationIds = memberships
      .filter((m) =>
        [MembershipStatus.ACTIVE, MembershipStatus.GRACE, MembershipStatus.PENDING_PAYMENT].includes(
          m.status,
        ),
      )
      .map((m) => m.locationId);

    if (memberLocationIds.length === 0) {
      return [];
    }

    return this.locationRepo.find({
      where: {
        id: In(memberLocationIds),
        kind: LocationKind.CHILD,
        status: "active",
      },
      order: { name: "ASC" },
    });
  }

  async findOne(id: string) {
    const location = await this.locationRepo.findOne({
      where: { id },
      relations: { parentLocation: true },
    });
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
