import { Injectable, NotFoundException } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { buildListResponse, ListResponse } from "@app/common";
import { Court } from "./entities/court.entity";
import { Coach } from "../coaches/entities/coach.entity";
import { CreateCourtDto } from "./dto/create-court.dto";
import { UpdateCourtDto } from "./dto/update-court.dto";

@Injectable()
export class CourtsService {
  constructor(
    @InjectRepository(Court)
    private readonly courtRepo: Repository<Court>,
    @InjectRepository(Coach)
    private readonly coachRepo: Repository<Coach>,
  ) {}

  async create(dto: CreateCourtDto) {
    const court = this.courtRepo.create({
      ...dto,
      pricePerHour: String(dto.pricePerHour ?? 0),
      imageGallery: dto.imageGallery ?? null,
      mapEmbedUrl: dto.mapEmbedUrl ?? null,
    });
    return this.courtRepo.save(court);
  }

  async findAll(
    locationId?: string,
    branchId?: string,
    status?: string,
    search?: string,
    sport?: string,
    pageIndex = 0,
    pageSize = 500,
  ): Promise<ListResponse<Court>> {
    const qb = this.courtRepo
      .createQueryBuilder("court")
      .leftJoinAndSelect("court.location", "location");
    if (locationId) qb.andWhere("court.locationId = :locationId", { locationId });
    if (branchId) qb.andWhere("location.branchId = :branchId", { branchId });
    if (status) qb.andWhere("court.status = :status", { status });
    if (sport) qb.andWhere("court.sport = :sport", { sport });
    if (search && search.trim()) {
      qb.andWhere("LOWER(court.name) LIKE :q", {
        q: `%${search.trim().toLowerCase()}%`,
      });
    }
    qb.orderBy("court.name", "ASC");
    const safePage = Math.max(0, pageIndex);
    const safeSize = Math.min(1000, Math.max(1, pageSize));
    const total = await qb.clone().getCount();
    const data = await qb
      .skip(safePage * safeSize)
      .take(safeSize)
      .getMany();
    return buildListResponse(data, total, safePage, safeSize);
  }

  async findOne(id: string) {
    const court = await this.courtRepo.findOne({
      where: { id },
      relations: { location: true },
    });
    if (!court) throw new NotFoundException("Court not found");
    const coaches = await this.coachRepo
      .createQueryBuilder("coach")
      .leftJoinAndSelect("coach.user", "user")
      .where("user.courtId = :courtId", { courtId: id })
      .orderBy("user.fullName", "ASC")
      .getMany();
    return { ...court, coaches };
  }

  async update(id: string, dto: UpdateCourtDto) {
    await this.findOne(id);
    await this.courtRepo.update(id, {
      ...dto,
      ...(dto.pricePerHour !== undefined && {
        pricePerHour: String(dto.pricePerHour),
      }),
      ...(dto.imageGallery !== undefined && { imageGallery: dto.imageGallery }),
      ...(dto.mapEmbedUrl !== undefined && { mapEmbedUrl: dto.mapEmbedUrl }),
    });
    return this.findOne(id);
  }

  async remove(id: string) {
    await this.findOne(id);
    await this.courtRepo.delete(id);
    return { deleted: true };
  }
}
