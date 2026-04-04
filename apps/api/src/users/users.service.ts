import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Brackets, In, Repository } from "typeorm";
import * as bcrypt from "bcrypt";
import { User } from "./entities/user.entity";
import { UserAccountType } from "./entities/user-account-type.enum";
import { CreateUserDto } from "./dto/create-user.dto";
import { CreateMembershipPlaceholderDto } from "./dto/create-membership-placeholder.dto";
import { UpdateUserDto } from "./dto/update-user.dto";
import { UpdateOwnProfileDto } from "./dto/update-own-profile.dto";
import { RolesService } from "../roles/roles.service";
import { UserLocationMembership } from "../memberships/entities/user-location-membership.entity";
import { MembershipStatus } from "../memberships/entities/membership.enums";
import { Location } from "../locations/entities/location.entity";
import { Area } from "../areas/entities/area.entity";

function sanitizeUser<T extends Partial<User>>(
  user: T,
): Omit<T, "passwordHash"> {
  if (!user) return user;
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { passwordHash: _, ...rest } = user;
  return rest as Omit<T, "passwordHash">;
}

function membershipYmd(
  d: Date | string | null | undefined,
): string | null {
  if (d === null || d === undefined) return null;
  const x = d instanceof Date ? d : new Date(d);
  if (Number.isNaN(x.getTime())) return null;
  return x.toISOString().slice(0, 10);
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
    private rolesService: RolesService,
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
    accountType?: string,
    excludeAccountType?: string,
    includeMemberships?: boolean,
    requester?: UserRequesterScope,
  ) {
    let membershipFilterLocationId: string | undefined;
    if (areaId?.trim()) {
      const area = await this.areaRepo.findOne({
        where: { id: areaId.trim() },
      });
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
      /**
       * Venue staff used to inner-join memberships only, so anyone with zero venue rows
       * disappeared from the list after “remove all memberships” (even accountType membership).
       * Include membership placeholders with no membership row; still require venue overlap
       * when onlyMembership filters list-eligible statuses.
       */
      qb.andWhere(
        new Brackets((w) => {
          if (onlyMembership) {
            w.where(
              `EXISTS (
                SELECT 1 FROM user_location_memberships um
                WHERE um."userId" = user.id
                AND um."locationId" IN (:...locIds)
                AND um.status IN (:...umStatuses)
              )`,
              { locIds: locIdsForJoin, umStatuses: MEMBERSHIP_LIST_STATUSES },
            );
          } else {
            w.where(
              `EXISTS (
                SELECT 1 FROM user_location_memberships um
                WHERE um."userId" = user.id
                AND um."locationId" IN (:...locIds)
              )`,
              { locIds: locIdsForJoin },
            ).orWhere(
              `user.accountType = :orphanMembershipAt AND NOT EXISTS (
                SELECT 1 FROM user_location_memberships nmu WHERE nmu."userId" = user.id
              )`,
              { orphanMembershipAt: UserAccountType.MEMBERSHIP },
            );
          }
        }),
      );
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
    if (
      forAreaAssignment &&
      requester?.role === "super_user" &&
      superUserLocIds?.length
    ) {
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
        throw new ForbiddenException(
          "Only super administrators can use this filter",
        );
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
    if (accountType?.trim()) {
      qb.andWhere("user.accountType = :accountTypeFilter", {
        accountTypeFilter: accountType.trim(),
      });
    } else if (excludeAccountType?.trim()) {
      qb.andWhere("user.accountType != :excludeAccountTypeFilter", {
        excludeAccountTypeFilter: excludeAccountType.trim(),
      });
    }
    const list = await qb.getMany();
    const sanitized = list.map(sanitizeUser);
    if (!includeMemberships || sanitized.length === 0) return sanitized;

    const ids = sanitized.map((u) => u.id);
    const rows = await this.membershipRepo.find({
      where: { userId: In(ids) },
      order: { locationId: "ASC" },
    });
    const byUser = new Map<string, UserLocationMembership[]>();
    for (const m of rows) {
      const arr = byUser.get(m.userId) ?? [];
      arr.push(m);
      byUser.set(m.userId, arr);
    }
    return sanitized.map((u) => ({
      ...u,
      memberships: (byUser.get(u.id) ?? []).map((m) => ({
        id: m.id,
        locationId: m.locationId,
        status: m.status,
        joinDate: membershipYmd(m.currentPeriodStart),
        endDate: membershipYmd(m.currentPeriodEnd),
      })),
    }));
  }

  /**
   * All user_location_memberships — super_admin Locations admin UI.
   * Includes both root (organization) and child venues; booking logic also allows membership on either.
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
      .innerJoinAndSelect("m.location", "location")
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
    const memberships = await this.membershipRepo.find({
      where: { userId: id },
    });
    return {
      ...base,
      memberships: memberships.map((m) => ({
        id: m.id,
        locationId: m.locationId,
        status: m.status,
        joinDate: membershipYmd(m.currentPeriodStart),
        endDate: membershipYmd(m.currentPeriodEnd),
      })),
    };
  }

  async findByEmail(email: string) {
    return this.userRepo.findOne({
      where: { email },
      relations: ["role"],
    });
  }

  /** Current user updates their own name, email, phone (no admin permission). */
  async updateOwnProfile(userId: string, dto: UpdateOwnProfileDto) {
    const user = await this.userRepo.findOne({
      where: { id: userId },
      relations: ["role"],
    });
    if (!user) throw new NotFoundException("User not found");

    if (dto.email !== undefined) {
      const next = dto.email.trim().toLowerCase();
      if (next !== user.email.toLowerCase()) {
        const existing = await this.userRepo.findOne({ where: { email: next } });
        if (existing) {
          throw new BadRequestException("Email already in use");
        }
        user.email = next;
      }
    }

    if (dto.firstName !== undefined) {
      const t = dto.firstName.trim();
      if (!t) throw new BadRequestException("First name cannot be empty");
      user.firstName = t;
    }
    if (dto.lastName !== undefined) {
      const t = dto.lastName.trim();
      if (!t) throw new BadRequestException("Last name cannot be empty");
      user.lastName = t;
    }
    if (dto.firstName !== undefined || dto.lastName !== undefined) {
      const fn = (user.firstName ?? "").trim();
      const ln = (user.lastName ?? "").trim();
      const combined = `${fn} ${ln}`.trim();
      if (combined) {
        user.fullName = combined;
      }
    }

    if (dto.phone !== undefined) {
      user.phone = dto.phone.trim();
    }

    await this.userRepo.save(user);
    return this.findOne(userId, true);
  }

  /** Pre-approved membership row (no password until user completes /register). */
  async createMembershipPlaceholder(
    dto: CreateMembershipPlaceholderDto,
    requester?: UserRequesterScope,
  ) {
    const email = dto.email.trim().toLowerCase();
    const existing = await this.userRepo.findOne({ where: { email } });
    if (existing) {
      throw new BadRequestException("User with this email already exists");
    }
    if (requester?.role === "super_user") {
      const my = await this.memberLocationIdsForUser(requester.id);
      if (my.length === 0) {
        throw new ForbiddenException("No location scope for this account");
      }
      if (dto.membershipLocationId && !my.includes(dto.membershipLocationId)) {
        throw new ForbiddenException(
          "Cannot assign membership outside your locations",
        );
      }
    }
    const player = await this.rolesService.findByName("player");
    if (!player) {
      throw new BadRequestException("Default player role is missing");
    }
    const resolvedFirstName =
      dto.firstName?.trim() || dto.fullName.trim().split(/\s+/)[0] || null;
    const resolvedLastName =
      dto.lastName?.trim() ||
      dto.fullName.trim().split(/\s+/).slice(1).join(" ").trim() ||
      null;
    const user = await this.userRepo.save(
      this.userRepo.create({
        email,
        passwordHash: null,
        fullName: dto.fullName.trim(),
        firstName: resolvedFirstName,
        lastName: resolvedLastName,
        phone: dto.phone,
        homeAddress: dto.homeAddress ?? null,
        roleId: player.id,
        accountType: UserAccountType.MEMBERSHIP,
        status: "active",
        visibility: "public",
      }),
    );
    if (dto.membershipLocationId) {
      await this.membershipRepo.save(
        this.membershipRepo.create({
          userId: user.id,
          locationId: dto.membershipLocationId,
          status: MembershipStatus.PENDING_PAYMENT,
          currentPeriodStart: dto.membershipJoinDate
            ? new Date(dto.membershipJoinDate)
            : null,
          currentPeriodEnd: dto.membershipEndDate
            ? new Date(dto.membershipEndDate)
            : null,
        }),
      );
    }
    const withRole = await this.userRepo.findOne({
      where: { id: user.id },
      relations: ["role"],
    });
    return sanitizeUser(withRole!);
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
        throw new ForbiddenException(
          "Cannot assign membership outside your locations",
        );
      }
    }
    const passwordHash = await bcrypt.hash(dto.password, 10);
    const roleEntity = await this.rolesService.findOne(dto.roleId);
    const staffRoleNames = new Set([
      "super_admin",
      "admin",
      "super_user",
      "coach",
    ]);
    const accountType = staffRoleNames.has(roleEntity.name)
      ? UserAccountType.SYSTEM
      : UserAccountType.NORMAL;
    const user = await this.userRepo.save(
      this.userRepo.create({
        email: dto.email,
        passwordHash,
        fullName: dto.fullName,
        firstName: dto.firstName ?? null,
        lastName: dto.lastName ?? null,
        phone: dto.phone,
        homeAddress: dto.homeAddress ?? null,
        roleId: dto.roleId,
        mustChangePasswordOnFirstLogin:
          dto.mustChangePasswordOnFirstLogin ?? false,
        accountType,
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
    const user = await this.userRepo.findOne({
      where: { id },
      relations: ["role"],
    });
    if (!user) throw new NotFoundException("User not found");
    if (requester) {
      await this.assertSuperUserCanAccessTargetUser(requester, id);
    }
    if (dto.email && dto.email !== user.email) {
      const existing = await this.userRepo.findOne({
        where: { email: dto.email },
      });
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
      ...(dto.roleId !== undefined && { roleId: dto.roleId }),
      ...(dto.status !== undefined && { status: dto.status }),
      ...(dto.mustChangePasswordOnFirstLogin !== undefined && {
        mustChangePasswordOnFirstLogin: dto.mustChangePasswordOnFirstLogin,
      }),
      ...(dto.accountType !== undefined && { accountType: dto.accountType }),
    };
    if (dto.password) {
      updates.passwordHash = await bcrypt.hash(dto.password, 10);
    }
    await this.userRepo.update(id, updates);

    if (dto.membershipLocationId !== undefined) {
      if (
        dto.membershipLocationId === null ||
        dto.membershipLocationId === ""
      ) {
        if (requester?.role === "super_user") {
          throw new ForbiddenException("Cannot clear membership for this user");
        }
        await this.membershipRepo.delete({ userId: id });
      } else {
        if (requester?.role === "super_user") {
          const my = await this.memberLocationIdsForUser(requester.id);
          if (!my.includes(dto.membershipLocationId)) {
            throw new ForbiddenException(
              "Cannot assign membership outside your locations",
            );
          }
        }
        const locExists = await this.locationRepo.exist({
          where: { id: dto.membershipLocationId },
        });
        if (!locExists) {
          throw new BadRequestException("Invalid membership location");
        }
        const prevMembership = await this.membershipRepo.findOne({
          where: { userId: id },
        });
        const prevStart = prevMembership?.currentPeriodStart ?? null;
        const prevEnd = prevMembership?.currentPeriodEnd ?? null;
        await this.membershipRepo.delete({ userId: id });
        await this.membershipRepo.save(
          this.membershipRepo.create({
            userId: id,
            locationId: dto.membershipLocationId,
            status: MembershipStatus.ACTIVE,
            currentPeriodStart:
              dto.membershipJoinDate !== undefined
                ? dto.membershipJoinDate
                  ? new Date(dto.membershipJoinDate)
                  : null
                : prevStart,
            currentPeriodEnd:
              dto.membershipEndDate !== undefined
                ? dto.membershipEndDate
                  ? new Date(dto.membershipEndDate)
                  : null
                : prevEnd,
          }),
        );
      }
    } else if (
      dto.membershipJoinDate !== undefined ||
      dto.membershipEndDate !== undefined
    ) {
      const m = await this.membershipRepo.findOne({ where: { userId: id } });
      if (m) {
        await this.membershipRepo.update(m.id, {
          ...(dto.membershipJoinDate !== undefined && {
            currentPeriodStart: dto.membershipJoinDate
              ? new Date(dto.membershipJoinDate)
              : null,
          }),
          ...(dto.membershipEndDate !== undefined && {
            currentPeriodEnd: dto.membershipEndDate
              ? new Date(dto.membershipEndDate)
              : null,
          }),
        });
      }
    }

    return this.findOne(id, false, requester);
  }

  async remove(id: string, requester?: UserRequesterScope) {
    const user = await this.userRepo.findOne({
      where: { id },
      relations: ["role"],
    });
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
