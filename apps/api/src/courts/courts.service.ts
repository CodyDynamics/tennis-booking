import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Brackets, Repository } from "typeorm";
import { buildListResponse, ListResponse } from "@app/common";
import { Court } from "./entities/court.entity";
import { Coach } from "../coaches/entities/coach.entity";
import { CreateCourtDto } from "./dto/create-court.dto";
import { UpdateCourtDto } from "./dto/update-court.dto";
import type { PerSportWindowDto } from "./dto/per-sport-window.dto";
import { LocationBookingWindow } from "../locations/entities/location-booking-window.entity";
import { CourtBookingWindowAdminDto } from "./dto/court-booking-window-admin.dto";
import { normalizeCourtSports } from "./court-sports.util";
import { normalizeCourtTypes } from "./court-types.util";

/**
 * Stored in `location_booking_windows.sport` for per-court windows.
 * Availability ignores this — which activities can book uses `courts.sports` (Court Management).
 */
const BOOKING_WINDOW_SPORT_SHARED = "*";

/** @deprecated Use pricePerHourPublic; kept on API responses for backward compatibility */
export type CourtWithLegacyPrice = Court & {
  pricePerHour: number;
  /** First sport for legacy UIs */
  sport: string;
  /** First environment tag for legacy UIs */
  type: string;
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

  private envTypesForCourt(court: Court): ("indoor" | "outdoor")[] {
    const envs = (court.courtTypes ?? []).filter(
      (t): t is "indoor" | "outdoor" => t === "indoor" || t === "outdoor",
    );
    return envs.length ? envs : ["outdoor"];
  }

  private async rewriteCourtWindows(
    court: Court,
    payload:
      | { mode: "shared"; start: string; end: string }
      | {
          mode: "per_sport";
          entries: { sport: string; start: string; end: string }[];
        },
  ) {
    const locId = court.locationId ?? "";
    const types = this.envTypesForCourt(court);
    await this.bookingWindowRepo.delete({ courtId: court.id });

    if (payload.mode === "shared") {
      this.validateWindowRange(payload.start, payload.end);
      for (const ct of types) {
        await this.bookingWindowRepo.save(
          this.bookingWindowRepo.create({
            locationId: locId,
            courtId: court.id,
            sport: BOOKING_WINDOW_SPORT_SHARED,
            courtType: ct,
            windowStartTime: payload.start,
            windowEndTime: payload.end,
            allowedDurationMinutes: "[30,60,90]",
            slotGridMinutes: 30,
            sortOrder: 0,
            isActive: true,
          }),
        );
      }
      return;
    }

    for (const e of payload.entries) {
      this.validateWindowRange(e.start, e.end);
      const sp = e.sport.trim().toLowerCase();
      for (const ct of types) {
        await this.bookingWindowRepo.save(
          this.bookingWindowRepo.create({
            locationId: locId,
            courtId: court.id,
            sport: sp,
            courtType: ct,
            windowStartTime: e.start,
            windowEndTime: e.end,
            allowedDurationMinutes: "[30,60,90]",
            slotGridMinutes: 30,
            sortOrder: 0,
            isActive: true,
          }),
        );
      }
    }
  }

  private scheduleFromCreateDto(dto: CreateCourtDto):
    | { mode: "shared"; start: string; end: string }
    | { mode: "per_sport"; entries: { sport: string; start: string; end: string }[] }
    | "clear"
    | null {
    if (dto.courtScheduleMode === "per_sport") {
      const list = dto.perSportWindows ?? [];
      if (list.length === 0) return "clear";
      return {
        mode: "per_sport",
        entries: list.map((e: PerSportWindowDto) => ({
          sport: e.sport.trim().toLowerCase(),
          start: e.windowStartTime,
          end: e.windowEndTime,
        })),
      };
    }
    if (dto.windowStartTime && dto.windowEndTime) {
      return {
        mode: "shared",
        start: dto.windowStartTime,
        end: dto.windowEndTime,
      };
    }
    return null;
  }

  private scheduleFromUpdateDto(
    dto: UpdateCourtDto,
  ):
    | { mode: "shared"; start: string; end: string }
    | { mode: "per_sport"; entries: { sport: string; start: string; end: string }[] }
    | "clear"
    | undefined {
    const touched =
      dto.courtScheduleMode !== undefined ||
      dto.perSportWindows !== undefined ||
      (dto.windowStartTime !== undefined && dto.windowEndTime !== undefined);
    if (!touched) return undefined;

    if (dto.courtScheduleMode === "per_sport") {
      const list = dto.perSportWindows ?? [];
      if (list.length === 0) return "clear";
      return {
        mode: "per_sport",
        entries: list.map((e) => ({
          sport: e.sport.trim().toLowerCase(),
          start: e.windowStartTime,
          end: e.windowEndTime,
        })),
      };
    }
    if (
      dto.courtScheduleMode === "shared" &&
      dto.windowStartTime &&
      dto.windowEndTime
    ) {
      return {
        mode: "shared",
        start: dto.windowStartTime,
        end: dto.windowEndTime,
      };
    }
    if (dto.windowStartTime !== undefined && dto.windowEndTime !== undefined) {
      return {
        mode: "shared",
        start: dto.windowStartTime,
        end: dto.windowEndTime,
      };
    }
    return undefined;
  }

  private withLegacyPrice(court: Court): CourtWithLegacyPrice {
    const sport = court.sports?.[0] ?? "tennis";
    const types = court.courtTypes?.length ? court.courtTypes : ["outdoor"];
    return {
      ...court,
      pricePerHour: parseFloat(court.pricePerHourPublic),
      sport,
      /** @deprecated use courtTypes */
      type: types[0],
    };
  }

  async create(dto: CreateCourtDto) {
    const {
      pricePerHour,
      pricePerHourPublic,
      pricePerHourMember,
      sports: sportsDto,
      sport: legacySport,
      courtTypes: courtTypesDto,
      type: legacyType,
      windowStartTime: _ws,
      windowEndTime: _we,
      courtScheduleMode: _csm,
      perSportWindows: _psw,
      ...courtFields
    } = dto;
    const pub = pricePerHourPublic ?? pricePerHour ?? 0;
    const sports = normalizeCourtSports(sportsDto, legacySport ?? null);
    const courtTypes = normalizeCourtTypes(courtTypesDto, legacyType ?? null);

    const court = this.courtRepo.create({
      ...courtFields,
      sports,
      courtTypes,
      pricePerHourPublic: String(pub),
      pricePerHourMember:
        pricePerHourMember !== undefined && pricePerHourMember !== null
          ? String(pricePerHourMember)
          : null,
      imageGallery: dto.imageGallery ?? null,
      mapEmbedUrl: dto.mapEmbedUrl ?? null,
    });
    const saved = await this.courtRepo.save(court);
    const sched = this.scheduleFromCreateDto(dto);
    if (sched === "clear") {
      await this.bookingWindowRepo.delete({ courtId: saved.id });
    } else if (sched) {
      await this.rewriteCourtWindows(saved, sched);
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
    if (search !== undefined && search !== null) {
      const frag = this.courtNameSearchSql("court.name", "courtNm", search);
      if (frag) qb.andWhere(frag.clause, frag.params);
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
      sports: sportsInDto,
      courtTypes: courtTypesInDto,
    } = dto;

    if (dto.name !== undefined) row.name = dto.name;
    if (dto.locationId !== undefined) row.locationId = dto.locationId;
    if (dto.areaId !== undefined) row.areaId = dto.areaId;
    if (courtTypesInDto !== undefined) {
      row.courtTypes = normalizeCourtTypes(courtTypesInDto, null);
    }
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

    const sched = this.scheduleFromUpdateDto(dto);
    if (sched === "clear") {
      await this.bookingWindowRepo.delete({ courtId: row.id });
    } else if (sched && sched !== undefined) {
      await this.rewriteCourtWindows(row, sched);
    }
    return this.findOne(id);
  }

  async remove(id: string) {
    await this.findOne(id);
    await this.courtRepo.delete(id);
    return { deleted: true };
  }

  /**
   * Court/location name search (aligned with frontend `courtNameMatchesSearch`):
   * - Trailing whitespace → exact match (case-insensitive).
   * - Otherwise → ILIKE %needle%.
   */
  private courtNameSearchSql(
    column: string,
    paramPrefix: string,
    search: string,
  ): { clause: string; params: Record<string, string> } | null {
    const raw = String(search);
    const trimmed = raw.trim();
    if (!trimmed) return null;
    const wantsExact = raw.length > raw.trimEnd().length;
    const needle = wantsExact ? raw.trimEnd().trim() : trimmed;
    if (wantsExact) {
      const p = `${paramPrefix}Exact`;
      return {
        clause: `LOWER(TRIM(BOTH FROM ${column})) = LOWER(TRIM(BOTH FROM :${p}))`,
        params: { [p]: needle },
      };
    }
    const p = `${paramPrefix}Like`;
    return {
      clause: `LOWER(${column}) LIKE :${p}`,
      params: { [p]: `%${needle.toLowerCase()}%` },
    };
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
    if (search !== undefined && search !== null && search.trim() !== "") {
      const fc = this.courtNameSearchSql("court.name", "cwCourt", search);
      const fl = this.courtNameSearchSql("location.name", "cwLoc", search);
      if (fc && fl) {
        qb.andWhere(
          new Brackets((wqb) => {
            wqb.where(fc.clause, fc.params).orWhere(fl.clause, fl.params);
          }),
        );
      }
    }
    qb.orderBy("location.name", "ASC")
      .addOrderBy("court.name", "ASC")
      .addOrderBy("w.windowStartTime", "ASC");
    const rows = await qb.getMany();
    return rows.map((w) => {
      const court = w.court!;
      const loc = w.location;
      const courtSports = court.sports?.length ? [...court.sports] : [];
      return {
        id: w.id,
        courtId: court.id,
        courtName: court.name,
        locationId: w.locationId,
        locationName: loc?.name ?? "",
        sport: w.sport,
        courtSports,
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
