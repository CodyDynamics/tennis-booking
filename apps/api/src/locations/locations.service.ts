import { Injectable, NotFoundException } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { buildListResponse, ListResponse } from "@app/common";
import { Location } from "./entities/location.entity";
import { CreateLocationDto } from "./dto/create-location.dto";
import { UpdateLocationDto } from "./dto/update-location.dto";

@Injectable()
export class LocationsService {
  constructor(
    @InjectRepository(Location)
    private locationRepo: Repository<Location>,
  ) {}

  async create(dto: CreateLocationDto) {
    return this.locationRepo.save(this.locationRepo.create(dto));
  }

  async findAll(
    branchId?: string,
    pageIndex = 0,
    pageSize = 200,
  ): Promise<ListResponse<Location>> {
    const qb = this.locationRepo
      .createQueryBuilder("location")
      .orderBy("location.name", "ASC");
    if (branchId) {
      qb.andWhere("location.branchId = :branchId", { branchId });
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

  async findOne(id: string) {
    const location = await this.locationRepo.findOne({ where: { id } });
    if (!location) throw new NotFoundException('Location not found');
    return location;
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
