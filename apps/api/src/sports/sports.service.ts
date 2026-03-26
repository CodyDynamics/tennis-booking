import { Injectable, NotFoundException } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { Sport } from "./entities/sport.entity";
import { CreateSportDto } from "./dto/create-sport.dto";
import { UpdateSportDto } from "./dto/update-sport.dto";

@Injectable()
export class SportsService {
  constructor(
    @InjectRepository(Sport)
    private readonly sportRepo: Repository<Sport>,
  ) {}

  async findAll(): Promise<Sport[]> {
    return this.sportRepo.find({ order: { name: "ASC" } });
  }

  async findByCode(code: string): Promise<Sport | null> {
    return this.sportRepo.findOne({ where: { code } });
  }

  async create(dto: CreateSportDto): Promise<Sport> {
    const row = this.sportRepo.create({
      code: dto.code.trim(),
      name: dto.name.trim(),
      description: dto.description?.trim() || null,
      imageUrl: dto.imageUrl?.trim() || null,
    });
    return this.sportRepo.save(row);
  }

  async update(id: string, dto: UpdateSportDto): Promise<Sport> {
    const row = await this.sportRepo.findOne({ where: { id } });
    if (!row) throw new NotFoundException("Sport not found");
    if (dto.code !== undefined) row.code = dto.code.trim();
    if (dto.name !== undefined) row.name = dto.name.trim();
    if (dto.description !== undefined) row.description = dto.description?.trim() || null;
    if (dto.imageUrl !== undefined) row.imageUrl = dto.imageUrl?.trim() || null;
    return this.sportRepo.save(row);
  }

  async remove(id: string): Promise<{ deleted: boolean }> {
    const row = await this.sportRepo.findOne({ where: { id } });
    if (!row) throw new NotFoundException("Sport not found");
    await this.sportRepo.delete(id);
    return { deleted: true };
  }
}
