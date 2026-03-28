import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { buildListResponse, ListResponse } from "@app/common";
import { Court } from "./entities/court.entity";
import { Coach } from "../coaches/entities/coach.entity";
import { CreateCourtDto } from "./dto/create-court.dto";
import { UpdateCourtDto } from "./dto/update-court.dto";
import { LocationBookingWindow } from "../locations/entities/location-booking-window.entity";
import { Sport } from "../sports/entities/sport.entity";
import { CourtBookingWindowAdminDto } from "./dto/court-booking-window-admin.dto";

/** @deprecated Use pricePerHourPublic; kept on API responses for backward compatibility */
export type CourtWithLegacyPrice = Court & { pricePerHour: number };

@Injectable()
export class CourtsService {
  constructor(
    @InjectRepository(Court)
    private readonly courtRepo: Repository<Court>,
    @InjectRepository(Coach)
    private readonly coachRepo: Repository<Coach>,
    @InjectRepository(LocationBookingWindow)
    private readonly bookingWindowRepo: Repository<LocationBookingWindow>,
    @InjectRepository(Sport)
    private readonly sportRepo: Repository<Sport>,
  ) {}

  private validateWindowRange(start?: string, end?: string) {
    if (!start && !end) return;
    if (!start || !end) {
      throw new BadRequestException(
        "windowStartTime and windowEndTime must be provided together",
      );
    }
    if (end <= start) {
      throw new BadRequestException("windowEndTime must be after windowStartTime");
    }
  }

  private async upsertCourtWindow(
    court: Court,
    dto: { windowStartTime?: string; windowEndTime?: string },
  ) {
    this.validateWindowRange(dto.windowStartTime, dto.windowEndTime);
    if (!dto.windowStartTime || !dto.windowEndTime) return;

    const existing = await this.bookingWindowRepo.findOne({
      where: {
        courtId: court.id,
        locationId: court.locationId ?? "",
        sport: court.sport,
        courtType: court.type,
      },
      order: { sortOrder: "ASC" },
    });

    if (existing) {
      await this.bookingWindowRepo.update(existing.id, {
        windowStartTime: dto.windowStartTime,
        windowEndTime: dto.windowEndTime,
        allowedDurationMinutes: "[30,60,90]",
        slotGridMinutes: 30,
        isActive: true,
      });
      return;
    }

    await this.bookingWindowRepo.save(
      this.bookingWindowRepo.create({
        locationId: court.locationId ?? "",
        courtId: court.id,
        sport: court.sport,
        courtType: court.type,
        windowStartTime: dto.windowStartTime,
        windowEndTime: dto.windowEndTime,
        allowedDurationMinutes: "[30,60,90]",
        slotGridMinutes: 30,
        sortOrder: 0,
        isActive: true,
      }),
    );
  }

  private withLegacyPrice(court: Court): CourtWithLegacyPrice {
    return {
      ...court,
      pricePerHour: parseFloat(court.pricePerHourPublic),
    };
  }

  async create(dto: CreateCourtDto) {
    const {
      pricePerHour,
      pricePerHourPublic,
      pricePerHourMember,
      ...rest
    } = dto;
    const pub = pricePerHourPublic ?? pricePerHour ?? 0;
    let resolvedSport = dto.sport;
    if (dto.sportId) {
      const sport = await this.sportRepo.findOne({ where: { id: dto.sportId } });
      resolvedSport = sport?.code ?? dto.sport;
    }
    const court = this.courtRepo.create({
      ...rest,
      sport: resolvedSport ?? "tennis",
      pricePerHourPublic: String(pub),
      pricePerHourMember:
        pricePerHourMember !== undefined && pricePerHourMember !== null
          ? String(pricePerHourMember)
          : null,
      imageGallery: dto.imageGallery ?? null,
      mapEmbedUrl: dto.mapEmbedUrl ?? null,
    });
    const saved = await this.courtRepo.save(court);
    await this.upsertCourtWindow(saved, dto);
    return this.withLegacyPrice(saved);
  }

  async findAll(
    locationId?: string,
    branchId?: string,
    status?: string,
    search?: string,
    sport?: string,
    sportId?: string,
    pageIndex = 0,
    pageSize = 500,
  ): Promise<ListResponse<CourtWithLegacyPrice>> {
    const qb = this.courtRepo
      .createQueryBuilder("court")
      .leftJoinAndSelect("court.location", "location");
    if (locationId) qb.andWhere("court.locationId = :locationId", { locationId });
    if (branchId) qb.andWhere("location.branchId = :branchId", { branchId });
    if (status) qb.andWhere("court.status = :status", { status });
    if (sport) qb.andWhere("court.sport = :sport", { sport });
    if (sportId) qb.andWhere("court.sportId = :sportId", { sportId });
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
    return buildListResponse(
      data.map((c) => this.withLegacyPrice(c)),
      total,
      safePage,
      safeSize,
    );
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
    return { ...this.withLegacyPrice(court), coaches };
  }

  async update(id: string, dto: UpdateCourtDto) {
    const row = await this.courtRepo.findOne({ where: { id } });
    if (!row) throw new NotFoundException("Court not found");
    const {
      pricePerHour,
      pricePerHourPublic,
      pricePerHourMember,
      ...rest
    } = dto;
    const next: Partial<Court> = { ...rest };
    if (dto.sportId) {
      const sportRef = await this.sportRepo.findOne({ where: { id: dto.sportId } });
      next.sport = sportRef?.code ?? dto.sport ?? row.sport;
    } else if (dto.sport !== undefined) {
      next.sport = dto.sport;
    }
    Object.assign(row, next);
    if (pricePerHourPublic !== undefined || pricePerHour !== undefined) {
      const pub = pricePerHourPublic ?? pricePerHour;
      row.pricePerHourPublic = String(pub ?? row.pricePerHourPublic);
    }
    if (pricePerHourMember !== undefined) {
      row.pricePerHourMember =
        pricePerHourMember === null ? null : String(pricePerHourMember);
    }
    await this.courtRepo.save(row);
    await this.upsertCourtWindow(row, dto);
    return this.findOne(id);
  }

  async remove(id: string) {
    await this.findOne(id);
    await this.courtRepo.delete(id);
    return { deleted: true };
  }

  private timeToHHmm(value: string | Date | undefined | null): string {
    if (value === undefined || value === null) return "00:00";
    if (typeof value === "string") {
      return value.length >= 5 ? value.slice(0, 5) : value;
    }
    if (value instanceof Date) {
      const h = value.getUTCHours();
      const m = value.getUTCMinutes();
      return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
    }
    return "00:00";
  }

  /**
   * Admin Court Time Slot list: only windows attached to a court (created via Court Management + slot).
   */
  async listCourtBookingWindowsForAdmin(
    branchId?: string,
    search?: string,
  ): Promise<CourtBookingWindowAdminDto[]> {
    const qb = this.bookingWindowRepo
      .createQueryBuilder("w")
      .innerJoinAndSelect("w.court", "court")
      .innerJoinAndSelect("w.location", "location")
      .where("w.courtId IS NOT NULL");
    if (branchId?.trim()) {
      qb.andWhere("location.branchId = :branchId", { branchId: branchId.trim() });
    }
    if (search?.trim()) {
      qb.andWhere(
        "(LOWER(court.name) LIKE :q OR LOWER(location.name) LIKE :q)",
        { q: `%${search.trim().toLowerCase()}%` },
      );
    }
    qb.orderBy("location.name", "ASC")
      .addOrderBy("court.name", "ASC")
      .addOrderBy("w.windowStartTime", "ASC");
    const rows = await qb.getMany();
    return rows.map((w) => {
      const court = w.court!;
      const loc = w.location;
      return {
        id: w.id,
        courtId: court.id,
        courtName: court.name,
        locationId: w.locationId,
        locationName: loc?.name ?? "",
        sport: w.sport,
        courtType: w.courtType,
        windowStartTime: this.timeToHHmm(
          w.windowStartTime as unknown as string | Date,
        ),
        windowEndTime: this.timeToHHmm(
          w.windowEndTime as unknown as string | Date,
        ),
        isActive: w.isActive,
        pricePerHour: parseFloat(String(court.pricePerHourPublic ?? 0)),
        courtStatus: court.status,
        description: court.description ?? null,
      };
    });
  }

  async removeCourtBookingWindow(windowId: string) {
    const w = await this.bookingWindowRepo.findOne({ where: { id: windowId } });
    if (!w) throw new NotFoundException("Booking window not found");
    if (!w.courtId) {
      throw new BadRequestException(
        "This window is not tied to a court; remove it from location settings instead.",
      );
    }
    await this.bookingWindowRepo.delete(windowId);
    return { deleted: true };
  }
}
