import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Brackets, Repository } from "typeorm";
import * as bcrypt from "bcrypt";
import { User } from "./entities/user.entity";
import { CreateUserDto } from "./dto/create-user.dto";
import { UpdateUserDto } from "./dto/update-user.dto";
import { UserLocationMembership } from "../memberships/entities/user-location-membership.entity";
import { MembershipStatus } from "../memberships/entities/membership.enums";
import { Location } from "../locations/entities/location.entity";
import { Area } from "../areas/entities/area.entity";
import { LocationKind } from "../locations/entities/location-kind.enum";

function sanitizeUser<T extends Partial<User>>(user: T): Omit<T, "passwordHash"> {
  if (!user) return user;
  const { passwordHash: _, ...rest } = user;
  return rest as Omit<T, "passwordHash">;
}

/** Eligible membership rows for “assigned to a location” (booking + admin scope). */
const MEMBERSHIP_SCOPING_STATUSES = [
  MembershipStatus.ACTIVE,
  MembershipStatus.GRACE,
  MembershipStatus.PENDING_PAYMENT,
];

const MEMBERSHIP_LIST_STATUSES = [
  MembershipStatus.ACTIVE,
  MembershipStatus.PENDING_PAYMENT,
  MembershipStatus.GRACE,
  MembershipStatus.LAPSED,
];

export type UserRequesterScope = { id: string; role: string | null };

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private userRepo: Repository<User>,
    @InjectRepository(UserLocationMembership)
    private membershipRepo: Repository<UserLocationMembership>,
    @InjectRepository(Location)
    private locationRepo: Repository<Location>,
    @InjectRepository(Area)
    private areaRepo: Repository<Area>,
  ) {}

  private async memberLocationIdsForUser(userId: string): Promise<string[]> {
    const rows = await this.membershipRepo.find({ where: { userId } });
    return rows
      .filter((m) => MEMBERSHIP_SCOPING_STATUSES.includes(m.status))
      .map((m) => m.locationId);
  }

  private async assertSuperUserCanAccessTargetUser(
    requester: UserRequesterScope,
    targetId: string,
  ): Promise<void> {
    if (requester.role !== "super_user") return;
    if (requester.id === targetId) return;
    const my = await this.memberLocationIdsForUser(requester.id);
    if (my.length === 0) {
      throw new ForbiddenException("No location scope for this account");
    }
    const targetMemberships = await this.membershipRepo.find({
      where: { userId: targetId },
    });
    if (targetMemberships.length === 0) {
      return;
    }
    const targetLoc = new Set(targetMemberships.map((m) => m.locationId));
    const ok = my.some((locId) => targetLoc.has(locId));
    if (!ok) {
      throw new ForbiddenException("User is outside your location scope");
    }
  }

  async findAll(
    roleId?: string,
    search?: string,
    onlyMembership?: boolean,
    noMembershipAtLocationId?: string,
    forAreaAssignment?: boolean,
    noMembershipAnywhere?: boolean,
    membershipAtLocationId?: string,
    areaId?: string,
    requester?: UserRequesterScope,
  ) {
    let membershipFilterLocationId: string | undefined;
    if (areaId?.trim()) {
      const area = await this.areaRepo.findOne({ where: { id: areaId.trim() } });
      if (!area) {
        throw new BadRequestException("Area not found");
      }
      membershipFilterLocationId = area.locationId;
    } else if (membershipAtLocationId?.trim()) {
      membershipFilterLocationId = membershipAtLocationId.trim();
    }

    let superUserLocIds: string[] | undefined;
    if (requester?.role === "super_user") {
      superUserLocIds = await this.memberLocationIdsForUser(requester.id);
      if (superUserLocIds.length === 0) {
        return [];
      }
      if (
        noMembershipAtLocationId &&
        !superUserLocIds.includes(noMembershipAtLocationId)
      ) {
        throw new ForbiddenException("Location is outside your scope");
      }
      if (
        membershipFilterLocationId &&
        !superUserLocIds.includes(membershipFilterLocationId)
      ) {
        throw new ForbiddenException("Location filter is outside your scope");
      }
    }

    const qb = this.userRepo
      .createQueryBuilder("user")
      .leftJoinAndSelect("user.role", "role")
      .orderBy("user.createdAt", "DESC");

    const isAdminScope =
      requester?.role === "super_admin" || requester?.role === "admin";

    const superUserVenueMemberList =
      requester?.role === "super_user" &&
      superUserLocIds?.length &&
      !noMembershipAtLocationId &&
      !forAreaAssignment;

    if (superUserVenueMemberList) {
      const locIdsForJoin = membershipFilterLocationId
        ? [membershipFilterLocationId]
        : superUserLocIds;
      qb.innerJoin(
        "user_location_memberships",
        "um",
        'um."userId" = user.id AND um."locationId" IN (:...locIds)',
        { locIds: locIdsForJoin },
      );
      if (onlyMembership) {
        qb.andWhere("um.status IN (:...umStatuses)", {
          umStatuses: MEMBERSHIP_LIST_STATUSES,
        });
      }
      qb.distinct(true);
    } else if (onlyMembership) {
      if (membershipFilterLocationId && isAdminScope) {
        qb.innerJoin(
          "user_location_memberships",
          "m",
          'm."userId" = user.id AND m."locationId" = :mfLoc AND m.status IN (:...mst)',
          {
            mfLoc: membershipFilterLocationId,
            mst: MEMBERSHIP_LIST_STATUSES,
          },
        );
      } else {
        qb.innerJoin(
          "user_location_memberships",
          "m",
          'm."userId" = user.id AND m.status IN (:...statuses)',
          {
            statuses: MEMBERSHIP_LIST_STATUSES,
          },
        );
      }
    } else if (membershipFilterLocationId && isAdminScope) {
      qb.innerJoin(
        "user_location_memberships",
        "mf",
        'mf."userId" = user.id AND mf."locationId" = :mfLoc AND mf.status IN (:...mfst)',
        {
          mfLoc: membershipFilterLocationId,
          mfst: MEMBERSHIP_LIST_STATUSES,
        },
      );
    }
    if (noMembershipAtLocationId) {
      qb.andWhere(
        `NOT EXISTS (
          SELECT 1 FROM user_location_memberships umb
          WHERE umb."userId" = user.id
          AND umb."locationId" = :nmLocId
          AND umb.status IN (:...nmStatuses)
        )`,
        {
          nmLocId: noMembershipAtLocationId,
          nmStatuses: MEMBERSHIP_SCOPING_STATUSES,
        },
      );
    }
    if (forAreaAssignment && requester?.role === "super_user" && superUserLocIds?.length) {
      qb.andWhere(
        new Brackets((w) => {
          w.where(
            `EXISTS (SELECT 1 FROM user_location_memberships fva WHERE fva."userId" = user.id AND fva."locationId" IN (:...fvaLocs))`,
            { fvaLocs: superUserLocIds },
          ).orWhere(
            `NOT EXISTS (SELECT 1 FROM user_location_memberships fvb WHERE fvb."userId" = user.id)`,
          );
        }),
      );
    }
    if (noMembershipAnywhere) {
      if (requester?.role !== "super_admin") {
        throw new ForbiddenException("Only super administrators can use this filter");
      }
      qb.andWhere(
        `NOT EXISTS (SELECT 1 FROM user_location_memberships nma WHERE nma."userId" = user.id)`,
      );
    }
    if (roleId) {
      qb.andWhere("user.roleId = :roleId", { roleId });
    }
    if (search && search.trim()) {
      qb.andWhere(
        "(LOWER(user.email) LIKE :q OR LOWER(user.fullName) LIKE :q)",
        { q: `%${search.trim().toLowerCase()}%` },
      );
    }
    const list = await qb.getMany();
    return list.map(sanitizeUser);
  }

  /**
   * All venue (child location) memberships — super_admin Locations admin UI.
   */
  async findVenueMembershipAssignments(requester: UserRequesterScope) {
    if (requester.role !== "super_admin") {
      throw new ForbiddenException(
        "Only super administrators can list venue memberships",
      );
    }
    const rows = await this.membershipRepo
      .createQueryBuilder("m")
      .innerJoinAndSelect("m.user", "user")
      .leftJoinAndSelect("user.role", "role")
      .leftJoinAndSelect("m.location", "location")
      .where("location.kind = :lk", { lk: LocationKind.CHILD })
      .orderBy("location.name", "ASC")
      .addOrderBy("user.email", "ASC")
      .getMany();

    return rows.map((m) => ({
      membershipId: m.id,
      userId: m.userId,
      email: m.user.email,
      firstName: m.user.firstName,
      lastName: m.user.lastName,
      roleName: m.user.role?.name ?? null,
      locationId: m.locationId,
      locationName: m.location?.name ?? "",
      status: m.status,
    }));
  }

  async findOne(
    id: string,
    includeMemberships = false,
    requester?: UserRequesterScope,
  ) {
    const user = await this.userRepo.findOne({
      where: { id },
      relations: ["role"],
    });
    if (!user) throw new NotFoundException("User not found");
    if (requester) {
      await this.assertSuperUserCanAccessTargetUser(requester, id);
    }
    const base = sanitizeUser(user);
    if (!includeMemberships) return base;
    const memberships = await this.membershipRepo.find({ where: { userId: id } });
    return {
      ...base,
      memberships: memberships.map((m) => ({
        id: m.id,
        locationId: m.locationId,
        status: m.status,
      })),
    };
  }

  async findByEmail(email: string) {
    return this.userRepo.findOne({
      where: { email },
      relations: ["role"],
    });
  }

  async create(dto: CreateUserDto, requester?: UserRequesterScope) {
    const existing = await this.userRepo.findOne({
      where: { email: dto.email },
    });
    if (existing) {
      throw new BadRequestException("User with this email already exists");
    }
    if (requester?.role === "super_user") {
      const my = await this.memberLocationIdsForUser(requester.id);
      if (my.length === 0) {
        throw new ForbiddenException("No location scope for this account");
      }
      if (dto.membershipLocationId && !my.includes(dto.membershipLocationId)) {
        throw new ForbiddenException("Cannot assign membership outside your locations");
      }
    }
    const passwordHash = await bcrypt.hash(dto.password, 10);
    const user = await this.userRepo.save(
      this.userRepo.create({
        email: dto.email,
        passwordHash,
        fullName: dto.fullName,
        firstName: dto.firstName ?? null,
        lastName: dto.lastName ?? null,
        phone: dto.phone,
        homeAddress: dto.homeAddress ?? null,
        organizationId: dto.organizationId ?? null,
        branchId: dto.branchId ?? null,
        roleId: dto.roleId,
        mustChangePasswordOnFirstLogin: dto.mustChangePasswordOnFirstLogin ?? false,
      }),
    );
    if (dto.membershipLocationId) {
      await this.membershipRepo.save(
        this.membershipRepo.create({
          userId: user.id,
          locationId: dto.membershipLocationId,
          status: MembershipStatus.PENDING_PAYMENT,
        }),
      );
    }
    const withRole = await this.userRepo.findOne({
      where: { id: user.id },
      relations: ["role"],
    });
    return sanitizeUser(withRole!);
  }

  async update(id: string, dto: UpdateUserDto, requester?: UserRequesterScope) {
    const user = await this.userRepo.findOne({ where: { id }, relations: ["role"] });
    if (!user) throw new NotFoundException("User not found");
    if (requester) {
      await this.assertSuperUserCanAccessTargetUser(requester, id);
    }
    if (dto.email && dto.email !== user.email) {
      const existing = await this.userRepo.findOne({ where: { email: dto.email } });
      if (existing) throw new BadRequestException("Email already in use");
    }
    const updates: Partial<User> = {
      ...(dto.fullName !== undefined && { fullName: dto.fullName }),
      ...(dto.firstName !== undefined && { firstName: dto.firstName ?? null }),
      ...(dto.lastName !== undefined && { lastName: dto.lastName ?? null }),
      ...(dto.email !== undefined && { email: dto.email }),
      ...(dto.phone !== undefined && { phone: dto.phone }),
      ...(dto.homeAddress !== undefined && {
        homeAddress: dto.homeAddress ?? null,
      }),
      ...(dto.organizationId !== undefined && { organizationId: dto.organizationId ?? null }),
      ...(dto.branchId !== undefined && { branchId: dto.branchId ?? null }),
      ...(dto.roleId !== undefined && { roleId: dto.roleId }),
      ...(dto.status !== undefined && { status: dto.status }),
      ...(dto.mustChangePasswordOnFirstLogin !== undefined && {
        mustChangePasswordOnFirstLogin: dto.mustChangePasswordOnFirstLogin,
      }),
    };
    if (dto.password) {
      updates.passwordHash = await bcrypt.hash(dto.password, 10);
    }
    await this.userRepo.update(id, updates);

    if (dto.membershipLocationId !== undefined) {
      if (dto.membershipLocationId === null || dto.membershipLocationId === "") {
        if (requester?.role === "super_user") {
          throw new ForbiddenException("Cannot clear membership for this user");
        }
        await this.membershipRepo.delete({ userId: id });
      } else {
        if (requester?.role === "super_user") {
          const my = await this.memberLocationIdsForUser(requester.id);
          if (!my.includes(dto.membershipLocationId)) {
            throw new ForbiddenException("Cannot assign membership outside your locations");
          }
        }
        const locExists = await this.locationRepo.exist({
          where: { id: dto.membershipLocationId },
        });
        if (!locExists) {
          throw new BadRequestException("Invalid membership location");
        }
        await this.membershipRepo.delete({ userId: id });
        await this.membershipRepo.save(
          this.membershipRepo.create({
            userId: id,
            locationId: dto.membershipLocationId,
            status: MembershipStatus.ACTIVE,
          }),
        );
      }
    }

    return this.findOne(id, false, requester);
  }

  async remove(id: string, requester?: UserRequesterScope) {
    const user = await this.userRepo.findOne({ where: { id }, relations: ["role"] });
    if (!user) throw new NotFoundException("User not found");
    if (requester) {
      await this.assertSuperUserCanAccessTargetUser(requester, id);
    }
    if (user.role?.name === "super_admin") {
      throw new ForbiddenException("Cannot delete this user");
    }
    await this.userRepo.delete(id);
    return { deleted: true };
  }
}
