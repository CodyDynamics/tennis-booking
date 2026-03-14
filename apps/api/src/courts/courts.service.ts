import { Injectable, NotFoundException } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { Court } from "./entities/court.entity";
import { CreateCourtDto } from "./dto/create-court.dto";
import { UpdateCourtDto } from "./dto/update-court.dto";

@Injectable()
export class CourtsService {
  constructor(
    @InjectRepository(Court)
    private readonly courtRepo: Repository<Court>,
  ) {}

  async create(dto: CreateCourtDto) {
    const court = this.courtRepo.create({
      ...dto,
      pricePerHour: String(dto.pricePerHour ?? 0),
    });
    return this.courtRepo.save(court);
  }

  async findAll(branchId?: string, status?: string) {
    const qb = this.courtRepo.createQueryBuilder("court").leftJoinAndSelect(
      "court.branch",
      "branch",
    );
    if (branchId) qb.andWhere("court.branchId = :branchId", { branchId });
    if (status) qb.andWhere("court.status = :status", { status });
    return qb.getMany();
  }

  async findOne(id: string) {
    const court = await this.courtRepo.findOne({
      where: { id },
      relations: { branch: true },
    });
    if (!court) throw new NotFoundException("Court not found");
    return court;
  }

  async update(id: string, dto: UpdateCourtDto) {
    await this.findOne(id);
    await this.courtRepo.update(id, {
      ...dto,
      ...(dto.pricePerHour !== undefined && {
        pricePerHour: String(dto.pricePerHour),
      }),
    });
    return this.findOne(id);
  }

  async remove(id: string) {
    await this.findOne(id);
    await this.courtRepo.delete(id);
    return { deleted: true };
  }
}
