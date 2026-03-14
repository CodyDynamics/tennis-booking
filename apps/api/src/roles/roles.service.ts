import { Injectable, NotFoundException } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { Role } from "./entities/role.entity";

@Injectable()
export class RolesService {
  constructor(
    @InjectRepository(Role)
    private readonly roleRepo: Repository<Role>,
  ) {}

  async findAll() {
    return this.roleRepo.find({ order: { name: "ASC" } });
  }

  async findOne(id: string) {
    const role = await this.roleRepo.findOne({ where: { id } });
    if (!role) throw new NotFoundException("Role not found");
    return role;
  }

  async findByName(name: string) {
    return this.roleRepo.findOne({ where: { name } });
  }
}
