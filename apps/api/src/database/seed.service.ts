import { Injectable, OnModuleInit } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { Role } from "../roles/entities/role.entity";

const DEFAULT_ROLES = [
  { name: "admin", description: "System administrator" },
  { name: "player", description: "Casual player who can book courts" },
  { name: "coach", description: "Tennis coach" },
  { name: "student", description: "Student" },
  { name: "parent", description: "Parent" },
];

@Injectable()
export class SeedService implements OnModuleInit {
  constructor(
    @InjectRepository(Role)
    private roleRepo: Repository<Role>,
  ) {}

  async onModuleInit() {
    for (const r of DEFAULT_ROLES) {
      const existing = await this.roleRepo.findOne({ where: { name: r.name } });
      if (!existing) {
        await this.roleRepo.save(this.roleRepo.create(r));
        console.log(`[SeedService] Created role: ${r.name}`);
      }
    }
  }
}
