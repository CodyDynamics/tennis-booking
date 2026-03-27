import { Injectable, NotFoundException, BadRequestException } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import * as bcrypt from "bcrypt";
import { User } from "./entities/user.entity";
import { CreateUserDto } from "./dto/create-user.dto";
import { UpdateUserDto } from "./dto/update-user.dto";
import { UserLocationMembership } from "../memberships/entities/user-location-membership.entity";
import { MembershipStatus } from "../memberships/entities/membership.enums";
import { Location } from "../locations/entities/location.entity";

function sanitizeUser<T extends Partial<User>>(user: T): Omit<T, "passwordHash"> {
  if (!user) return user;
  const { passwordHash: _, ...rest } = user;
  return rest as Omit<T, "passwordHash">;
}

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private userRepo: Repository<User>,
    @InjectRepository(UserLocationMembership)
    private membershipRepo: Repository<UserLocationMembership>,
    @InjectRepository(Location)
    private locationRepo: Repository<Location>,
  ) {}

  async findAll(roleId?: string, search?: string, onlyMembership?: boolean) {
    const qb = this.userRepo
      .createQueryBuilder("user")
      .leftJoinAndSelect("user.role", "role")
      .orderBy("user.createdAt", "DESC");
    if (onlyMembership) {
      qb.innerJoin(
        "user_location_memberships",
        "m",
        'm."userId" = user.id AND m.status IN (:...statuses)',
        {
          statuses: [
            MembershipStatus.ACTIVE,
            MembershipStatus.PENDING_PAYMENT,
            MembershipStatus.GRACE,
            MembershipStatus.LAPSED,
          ],
        },
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

  async findOne(id: string, includeMemberships = false) {
    const user = await this.userRepo.findOne({
      where: { id },
      relations: ["role"],
    });
    if (!user) throw new NotFoundException("User not found");
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

  async create(dto: CreateUserDto) {
    const existing = await this.userRepo.findOne({
      where: { email: dto.email },
    });
    if (existing) {
      throw new BadRequestException("User with this email already exists");
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

  async update(id: string, dto: UpdateUserDto) {
    const user = await this.userRepo.findOne({ where: { id }, relations: ["role"] });
    if (!user) throw new NotFoundException("User not found");
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
        await this.membershipRepo.delete({ userId: id });
      } else {
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

    return this.findOne(id);
  }

  async remove(id: string) {
    const user = await this.userRepo.findOne({ where: { id } });
    if (!user) throw new NotFoundException("User not found");
    await this.userRepo.delete(id);
    return { deleted: true };
  }
}
