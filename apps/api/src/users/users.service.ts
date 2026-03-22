import { Injectable, NotFoundException, BadRequestException } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import * as bcrypt from "bcrypt";
import { User } from "./entities/user.entity";
import { CreateUserDto } from "./dto/create-user.dto";
import { UpdateUserDto } from "./dto/update-user.dto";

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
  ) {}

  async findAll(roleId?: string, search?: string) {
    const qb = this.userRepo
      .createQueryBuilder("user")
      .leftJoinAndSelect("user.role", "role")
      .orderBy("user.createdAt", "DESC");
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

  async findOne(id: string) {
    const user = await this.userRepo.findOne({
      where: { id },
      relations: ["role"],
    });
    if (!user) throw new NotFoundException("User not found");
    return sanitizeUser(user);
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
        phone: dto.phone,
        homeAddress: dto.homeAddress ?? null,
        organizationId: dto.organizationId ?? null,
        branchId: dto.branchId ?? null,
        roleId: dto.roleId,
      }),
    );
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
      ...(dto.email !== undefined && { email: dto.email }),
      ...(dto.phone !== undefined && { phone: dto.phone }),
      ...(dto.homeAddress !== undefined && {
        homeAddress: dto.homeAddress ?? null,
      }),
      ...(dto.organizationId !== undefined && { organizationId: dto.organizationId ?? null }),
      ...(dto.branchId !== undefined && { branchId: dto.branchId ?? null }),
      ...(dto.roleId !== undefined && { roleId: dto.roleId }),
      ...(dto.status !== undefined && { status: dto.status }),
    };
    if (dto.password) {
      updates.passwordHash = await bcrypt.hash(dto.password, 10);
    }
    await this.userRepo.update(id, updates);
    return this.findOne(id);
  }

  async remove(id: string) {
    const user = await this.userRepo.findOne({ where: { id } });
    if (!user) throw new NotFoundException("User not found");
    await this.userRepo.delete(id);
    return { deleted: true };
  }
}
