import { Injectable, NotFoundException } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { Branch } from "./entities/branch.entity";
import { CreateBranchDto } from "./dto/create-branch.dto";
import { UpdateBranchDto } from "./dto/update-branch.dto";

@Injectable()
export class BranchesService {
  constructor(
    @InjectRepository(Branch)
    private readonly branchRepo: Repository<Branch>,
  ) {}

  async create(dto: CreateBranchDto) {
    const branch = this.branchRepo.create({
      name: dto.name,
      organizationId: dto.organizationId ?? null,
      address: dto.address ?? null,
      phone: dto.phone ?? null,
    });
    return this.branchRepo.save(branch);
  }

  async findAll(organizationId?: string) {
    const qb = this.branchRepo.createQueryBuilder("branch").orderBy(
      "branch.createdAt",
      "DESC",
    );
    if (organizationId) {
      qb.andWhere("branch.organizationId = :organizationId", {
        organizationId,
      });
    }
    return qb.getMany();
  }

  async findOne(id: string) {
    const branch = await this.branchRepo.findOne({ where: { id } });
    if (!branch) throw new NotFoundException("Branch not found");
    return branch;
  }

  async update(id: string, dto: UpdateBranchDto) {
    await this.findOne(id);
    await this.branchRepo.update(id, {
      ...(dto.name !== undefined && { name: dto.name }),
      ...(dto.organizationId !== undefined && {
        organizationId: dto.organizationId ?? null,
      }),
      ...(dto.address !== undefined && { address: dto.address ?? null }),
      ...(dto.phone !== undefined && { phone: dto.phone ?? null }),
    });
    return this.findOne(id);
  }

  async remove(id: string) {
    await this.findOne(id);
    await this.branchRepo.delete(id);
    return { deleted: true };
  }
}
