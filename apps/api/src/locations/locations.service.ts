import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
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

  /** Admin-assigned venue membership: any status except lapsed/cancelled may book / see bookable venues. */
  private isVenueMembershipEligibleForBooking(status: MembershipStatus): boolean {
    return (
      status !== MembershipStatus.CANCELLED &&
      status !== MembershipStatus.LAPSED
    );
  }

  /**
   * Active location IDs the user may use for Reserve (root and/or child), aligned with `findBookableForUser`.
   */
  async getBookableLocationIdsForUser(userId: string): Promise<string[]> {
    const user = await this.userRepo.findOne({
      where: { id: userId },
      relations: ["role"],
    });
    if (user?.role?.name === "super_admin") {
      const rows = await this.locationRepo.find({
        select: ["id"],
        where: { status: "active" },
      });
      return rows.map((r) => r.id);
    }

    const memberships = await this.membershipRepo.find({ where: { userId } });
    const eligible = memberships.filter((m) =>
      this.isVenueMembershipEligibleForBooking(m.status),
    );
    if (eligible.length === 0) return [];

    const ids = await this.expandEligibleMembershipsToBookableLocationIds(eligible);
    return [...ids];
  }

  /**
   * Maps membership rows to bookable location IDs: assigned active root/child, plus active child venues under an assigned root.
   */
  private async expandEligibleMembershipsToBookableLocationIds(
    eligible: UserLocationMembership[],
  ): Promise<Set<string>> {
    const memberLocationIds = [...new Set(eligible.map((m) => m.locationId))];
    const memberLocs = await this.locationRepo.find({
      where: { id: In(memberLocationIds) },
    });
    const bookableIds = new Set<string>();
    const rootIds: string[] = [];
    for (const loc of memberLocs) {
      if (loc.status !== "active") continue;
      if (loc.kind === LocationKind.CHILD) {
        bookableIds.add(loc.id);
      } else if (loc.kind === LocationKind.ROOT) {
        bookableIds.add(loc.id);
        rootIds.push(loc.id);
      }
    }
    if (rootIds.length > 0) {
      const underRoot = await this.locationRepo.find({
        where: {
          parentLocationId: In(rootIds),
          kind: LocationKind.CHILD,
          status: "active",
        },
      });
      for (const c of underRoot) bookableIds.add(c.id);
    }
    return bookableIds;
  }

  /**
   * Membership row to attach for private-venue booking (or access checks).
   * Root-level membership covers the root itself and active child venues under that root.
   */
  async findMembershipRowForVenueAccess(
    userId: string,
    venueLocationId: string,
  ): Promise<UserLocationMembership | null> {
    const memberships = await this.membershipRepo.find({ where: { userId } });
    const eligible = memberships.filter((m) =>
      this.isVenueMembershipEligibleForBooking(m.status),
    );
    if (eligible.length === 0) return null;

    const bookableIds = await this.expandEligibleMembershipsToBookableLocationIds(eligible);
    if (!bookableIds.has(venueLocationId)) return null;

    const venue = await this.locationRepo.findOne({
      where: { id: venueLocationId },
    });
    if (!venue) return null;

    const atVenue = eligible.find((m) => m.locationId === venueLocationId);
    if (atVenue) return atVenue;

    const parentId = venue.parentLocationId;
    if (parentId) {
      const atParent = eligible.find((m) => m.locationId === parentId);
      if (atParent) {
        const parentLoc = await this.locationRepo.findOne({
          where: { id: parentId },
        });
        if (parentLoc?.kind === LocationKind.ROOT) return atParent;
      }
    }

    return null;
  }

  async canAccessPrivateVenue(
    userId: string,
    venueLocationId: string,
  ): Promise<boolean> {
    const user = await this.userRepo.findOne({
      where: { id: userId },
      relations: ["role"],
    });
    if (user?.role?.name === "super_admin") return true;
    return !!(await this.findMembershipRowForVenueAccess(userId, venueLocationId));
  }

  /**
   * @returns membership row for `userLocationMembershipId`, or null for super_admin (no row).
   */
  async requirePrivateVenueMembershipForBooking(
    userId: string,
    venueLocationId: string,
  ): Promise<UserLocationMembership | null> {
    const user = await this.userRepo.findOne({
      where: { id: userId },
      relations: ["role"],
    });
    if (user?.role?.name === "super_admin") return null;

    const m = await this.findMembershipRowForVenueAccess(userId, venueLocationId);
    if (!m) {
      throw new ForbiddenException(
        "A venue membership is required to book courts at this private location",
      );
    }
    return m;
  }

  async create(dto: CreateLocationDto) {
    return this.locationRepo.save(
      this.locationRepo.create({
        ...dto,
        branchId: dto.branchId ?? null,
      }),
    );
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
   * - super_admin: all active locations (root + child).
   * - User with eligible membership (not cancelled/lapsed): every active location row they are assigned to (root or child),
   *   plus active child venues under an assigned root.
   * - No membership: none.
   */
  async findBookableForUser(userId: string): Promise<Location[]> {
    const ids = await this.getBookableLocationIdsForUser(userId);
    if (ids.length === 0) return [];
    return this.locationRepo.find({
      where: {
        id: In(ids),
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
   * For private venues, hasActiveMembership means "may book here" (admin venue membership,
   * including pending_payment and membership attached at org root covering this child).
   */
  async getMembershipForUser(
    locationId: string,
    userId: string,
  ): Promise<LocationMembershipStatusDto> {
    const location = await this.findOne(locationId);
    const rowAtVenue = await this.membershipRepo.findOne({
      where: { locationId, userId },
    });
    if (location.visibility === LocationVisibility.PRIVATE) {
      const grant = await this.findMembershipRowForVenueAccess(userId, locationId);
      return {
        locationId: location.id,
        visibility: location.visibility,
        hasActiveMembership: !!grant,
        membershipStatus: rowAtVenue?.status ?? grant?.status ?? null,
      };
    }
    return {
      locationId: location.id,
      visibility: location.visibility,
      hasActiveMembership: rowAtVenue?.status === MembershipStatus.ACTIVE,
      membershipStatus: rowAtVenue?.status ?? null,
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
