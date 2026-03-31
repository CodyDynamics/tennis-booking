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
import { CourtBookingWindowAdminDto } from "./dto/court-booking-window-admin.dto";
import { normalizeCourtSports } from "./court-sports.util";

/** @deprecated Use pricePerHourPublic; kept on API responses for backward compatibility */
export type CourtWithLegacyPrice = Court & {
  pricePerHour: number;
  /** First sport for legacy UIs */
  sport: string;
};

@Injectable()
export class CourtsService {
  constructor(
    @InjectRepository(Court)
    private readonly courtRepo: Repository<Court>,
    @InjectRepository(Coach)
    private readonly coachRepo: Repository<Coach>,
    @InjectRepository(LocationBookingWindow)
    private readonly bookingWindowRepo: Repository<LocationBookingWindow>,
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
    windowSport: string,
  ) {
    this.validateWindowRange(dto.windowStartTime, dto.windowEndTime);
    if (!dto.windowStartTime || !dto.windowEndTime) return;

    const existing = await this.bookingWindowRepo.findOne({
      where: {
        courtId: court.id,
        locationId: court.locationId ?? "",
        sport: windowSport,
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
        sport: windowSport,
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
    const sport = court.sports?.[0] ?? "tennis";
    return {
      ...court,
      pricePerHour: parseFloat(court.pricePerHourPublic),
      sport,
    };
  }

  async create(dto: CreateCourtDto) {
    const {
      pricePerHour,
      pricePerHourPublic,
      pricePerHourMember,
      sports: sportsDto,
      sport: legacySport,
      windowStartTime: _ws,
      windowEndTime: _we,
      ...courtFields
    } = dto;
    const pub = pricePerHourPublic ?? pricePerHour ?? 0;
    const sports = normalizeCourtSports(sportsDto, legacySport ?? null);

    const court = this.courtRepo.create({
      ...courtFields,
      sports,
      pricePerHourPublic: String(pub),
      pricePerHourMember:
        pricePerHourMember !== undefined && pricePerHourMember !== null
          ? String(pricePerHourMember)
          : null,
      imageGallery: dto.imageGallery ?? null,
      mapEmbedUrl: dto.mapEmbedUrl ?? null,
    });
    const saved = await this.courtRepo.save(court);
    if (dto.windowStartTime && dto.windowEndTime) {
      for (const sp of sports) {
        await this.upsertCourtWindow(saved, dto, sp);
      }
    }
    return this.withLegacyPrice(saved);
  }

  async findAll(
    locationId?: string,
    status?: string,
    search?: string,
    sport?: string,
    pageIndex = 0,
    pageSize = 500,
  ): Promise<ListResponse<CourtWithLegacyPrice>> {
    const qb = this.courtRepo
      .createQueryBuilder("court")
      .leftJoinAndSelect("court.location", "location");
    if (locationId) qb.andWhere("court.locationId = :locationId", { locationId });
    if (status) qb.andWhere("court.status = :status", { status });
    if (sport?.trim()) {
      qb.andWhere(":sport = ANY(court.sports)", { sport: sport.trim().toLowerCase() });
    }
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
      sport: windowSportFromDto,
      sports: sportsInDto,
      windowStartTime,
      windowEndTime,
    } = dto;

    if (dto.name !== undefined) row.name = dto.name;
    if (dto.locationId !== undefined) row.locationId = dto.locationId;
    if (dto.areaId !== undefined) row.areaId = dto.areaId;
    if (dto.type !== undefined) row.type = dto.type;
    if (dto.description !== undefined) row.description = dto.description;
    if (dto.imageUrl !== undefined) row.imageUrl = dto.imageUrl;
    if (dto.imageGallery !== undefined) row.imageGallery = dto.imageGallery;
    if (dto.mapEmbedUrl !== undefined) row.mapEmbedUrl = dto.mapEmbedUrl;
    if (dto.status !== undefined) row.status = dto.status;

    if (sportsInDto !== undefined) {
      row.sports = normalizeCourtSports(sportsInDto, null);
    }

    if (pricePerHourPublic !== undefined || pricePerHour !== undefined) {
      const pub = pricePerHourPublic ?? pricePerHour;
      row.pricePerHourPublic = String(pub ?? row.pricePerHourPublic);
    }
    if (pricePerHourMember !== undefined) {
      row.pricePerHourMember =
        pricePerHourMember === null ? null : String(pricePerHourMember);
    }
    await this.courtRepo.save(row);

    if (windowStartTime !== undefined || windowEndTime !== undefined) {
      const ws =
        windowSportFromDto?.trim().toLowerCase() ??
        row.sports?.[0] ??
        "tennis";
      await this.upsertCourtWindow(row, { windowStartTime, windowEndTime }, ws);
    }
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

  async listCourtBookingWindowsForAdmin(
    search?: string,
  ): Promise<CourtBookingWindowAdminDto[]> {
    const qb = this.bookingWindowRepo
      .createQueryBuilder("w")
      .innerJoinAndSelect("w.court", "court")
      .innerJoinAndSelect("w.location", "location")
      .where("w.courtId IS NOT NULL");
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
