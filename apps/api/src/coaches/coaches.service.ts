import { Injectable, NotFoundException } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { buildListResponse, ListResponse } from "@app/common";
import { Coach } from "./entities/coach.entity";
import { CreateCoachDto } from "./dto/create-coach.dto";
import { UpdateCoachDto } from "./dto/update-coach.dto";

@Injectable()
export class CoachesService {
  constructor(
    @InjectRepository(Coach)
    private readonly coachRepo: Repository<Coach>,
  ) {}

  async create(dto: CreateCoachDto) {
    const coach = this.coachRepo.create({
      ...dto,
      hourlyRate: String(dto.hourlyRate ?? 0),
    });
    return this.coachRepo.save(coach);
  }

  /**
   * Public coach directory: users with a coach profile who are not assigned to
   * any court (`courtId` null) and have `visibility` = public.
   */
  async findDirectory(
    pageIndex = 0,
    pageSize = 100,
  ): Promise<ListResponse<Coach>> {
    const qb = this.coachRepo
      .createQueryBuilder("coach")
      .leftJoinAndSelect("coach.user", "user")
      .where("user.courtId IS NULL")
      .andWhere("user.visibility = :vis", { vis: "public" })
      .orderBy("coach.createdAt", "DESC");
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
    const coach = await this.coachRepo.findOne({
      where: { id },
      relations: { user: true },
    });
    if (!coach) throw new NotFoundException("Coach not found");
    return coach;
  }

  async findByUserId(userId: string) {
    return this.coachRepo.findOne({
      where: { userId },
      relations: { user: true },
    });
  }

  async update(id: string, dto: UpdateCoachDto) {
    await this.findOne(id);
    await this.coachRepo.update(id, {
      ...dto,
      ...(dto.hourlyRate !== undefined && { hourlyRate: String(dto.hourlyRate) }),
    });
    return this.findOne(id);
  }

  async remove(id: string) {
    await this.findOne(id);
    await this.coachRepo.delete(id);
    return { deleted: true };
  }
}
