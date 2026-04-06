import {
  Injectable,
  ConflictException,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  HttpException,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { In, Repository } from "typeorm";
import { CourtBookingHandler } from "./handlers/court-booking.handler";
import { CoachSessionHandler } from "./handlers/coach-session.handler";
import { CourtWizardAvailabilityService } from "./court-wizard-availability.service";
import { CreateCourtBookingDto } from "./dto/create-court-booking.dto";
import { AdminCreateCourtBookingDto } from "./dto/admin-create-court-booking.dto";
import { AdminCreateCourtBookingBatchDto } from "./dto/admin-create-court-booking-batch.dto";
import { CreateCoachSessionDto } from "./dto/create-coach-session.dto";
import { CreateCourtSlotBookingDto } from "./dto/create-court-slot-booking.dto";
import {
  CourtWizardAvailabilityQueryDto,
  CourtWizardWindowsQueryDto,
  CourtSlotQueryDto,
} from "./dto/court-wizard-query.dto";
import {
  BookingKind,
  CreateBookingResult,
} from "./interfaces/booking-handler.interface";
import { Court } from "../courts/entities/court.entity";
import { BookingMailService } from "../notifications/booking-mail.service";
import { Area } from "../areas/entities/area.entity";
import { LocationVisibility } from "../locations/entities/location.enums";
import { LocationsService } from "../locations/locations.service";
import {
  CourtBooking,
  CourtBookingStatus,
} from "./entities/court-booking.entity";
// (User/Location repos not needed yet; keep imports minimal)
import { AdminListCourtBookingsQueryDto } from "./dto/admin-list-court-bookings.query.dto";
import { AdminUpdateCourtBookingDto } from "./dto/admin-update-court-booking.dto";
import { CourtHoldGateway } from "./court-hold.gateway";

/**
 * Booking Service (Parent / Facade).
 * Booking là cha; ủy quyền cho:
 * - CourtBookingHandler (sân, có thể kèm coach)
 * - CoachSessionHandler (book coach riêng hoặc kèm sân)
 */
@Injectable()
export class BookingsService {
  constructor(
    private readonly courtBookingHandler: CourtBookingHandler,
    private readonly coachSessionHandler: CoachSessionHandler,
    private readonly courtWizardAvailability: CourtWizardAvailabilityService,
    private readonly bookingMailService: BookingMailService,
    private readonly locationsService: LocationsService,
    @InjectRepository(Court)
    private readonly courtRepo: Repository<Court>,
    @InjectRepository(Area)
    private readonly areaRepo: Repository<Area>,
    @InjectRepository(CourtBooking)
    private readonly courtBookingRepo: Repository<CourtBooking>,
    private readonly courtHoldGateway: CourtHoldGateway,
  ) {}

  /**
   * One active court booking per user per calendar day (any location).
   * Cancelled rows do not count. When rescheduling, pass excludeBookingId so the same row is ignored.
   */
  private async assertAtMostOneCourtBookingPerUserPerDay(
    userId: string,
    bookingDate: string,
    excludeBookingId?: string,
  ): Promise<void> {
    const day = bookingDate.slice(0, 10);
    const qb = this.courtBookingRepo
      .createQueryBuilder("cb")
      .where("cb.userId = :userId", { userId })
      .andWhere("cb.bookingDate = :day", { day })
      .andWhere("cb.bookingStatus != :cancelled", {
        cancelled: CourtBookingStatus.CANCELLED,
      });
    if (excludeBookingId) {
      qb.andWhere("cb.id != :excludeId", { excludeId: excludeBookingId });
    }
    const count = await qb.getCount();
    if (count > 0) {
      throw new ConflictException(
        "You already have a court booking on this date. Only one court booking per day is allowed.",
      );
    }
  }

  private async assertAreaAccess(
    userId: string,
    locationId: string,
    areaId?: string,
  ) {
    if (!areaId) return;
    const area = await this.areaRepo.findOne({ where: { id: areaId } });
    if (!area || area.locationId !== locationId || area.status !== "active") {
      throw new BadRequestException("Area is invalid for this location");
    }
    if (area.visibility === LocationVisibility.PRIVATE) {
      const ok = await this.locationsService.canAccessPrivateVenue(
        userId,
        locationId,
      );
      if (!ok) {
        throw new ForbiddenException("This area requires a venue membership");
      }
    }
  }

  // ----- Court booking (sân, optional coach) -----

  async createCourtBooking(userId: string, dto: CreateCourtBookingDto) {
    const duration =
      dto.durationMinutes ??
      this.getDurationMinutes(dto.startTime, dto.endTime);
    const result = await this.courtBookingHandler.create({
      userId,
      courtId: dto.courtId,
      bookingDate: dto.bookingDate,
      startTime: dto.startTime,
      endTime: dto.endTime,
      coachId: dto.coachId,
      durationMinutes: duration,
      locationBookingWindowId: dto.locationBookingWindowId,
    });
    void this.bookingMailService.sendBookingConfirmation(result.id, "created");
    const court = await this.courtRepo.findOne({ where: { id: dto.courtId } });
    if (court?.locationId) {
      const sport = court.sports?.[0] ?? null;
      const courtType = court.courtTypes?.[0] ?? null;
      this.courtHoldGateway.broadcastCourtBookingMutated(court.locationId, {
        bookingDate: dto.bookingDate.slice(0, 10),
        courtId: dto.courtId,
        sport,
        courtType,
      });
    }
    return result;
  }

  /**
   * Admin court calendar: create with bypass of “start time already passed today” in venue TZ,
   * and optional series id for cancel-all.
   */
  async adminCreateCourtCalendarBooking(
    userId: string,
    dto: AdminCreateCourtBookingDto,
  ) {
    const duration =
      dto.durationMinutes ??
      this.getDurationMinutes(dto.startTime, dto.endTime);
    const result = await this.courtBookingHandler.create({
      userId,
      courtId: dto.courtId,
      bookingDate: dto.bookingDate,
      startTime: dto.startTime,
      endTime: dto.endTime,
      coachId: dto.coachId,
      durationMinutes: duration,
      locationBookingWindowId: dto.locationBookingWindowId,
      bypassVenuePastStartCheck: true,
      adminCalendarSeriesId: dto.adminCalendarSeriesId ?? null,
    });
    if (dto.sendConfirmationEmail === true) {
      void this.bookingMailService.sendBookingConfirmation(result.id, "created");
    }
    const court = await this.courtRepo.findOne({ where: { id: dto.courtId } });
    if (court?.locationId) {
      const sport = court.sports?.[0] ?? null;
      const courtType = court.courtTypes?.[0] ?? null;
      this.courtHoldGateway.broadcastCourtBookingMutated(court.locationId, {
        bookingDate: dto.bookingDate.slice(0, 10),
        courtId: dto.courtId,
        sport,
        courtType,
      });
    }
    return result;
  }

  /**
   * Admin calendar: create many dates in one request. Optionally one summary email for all successes.
   */
  async adminCreateCourtCalendarBatch(
    userId: string,
    dto: AdminCreateCourtBookingBatchDto,
  ): Promise<{
    created: CreateBookingResult[];
    errors: { bookingDate: string; message: string }[];
  }> {
    const uniqueSorted = [
      ...new Set(dto.bookingDates.map((d) => d.slice(0, 10))),
    ].sort();
    const duration =
      dto.durationMinutes ??
      this.getDurationMinutes(dto.startTime, dto.endTime);
    const created: CreateBookingResult[] = [];
    const errors: { bookingDate: string; message: string }[] = [];

    for (const bookingDate of uniqueSorted) {
      try {
        const result = await this.courtBookingHandler.create({
          userId,
          courtId: dto.courtId,
          bookingDate,
          startTime: dto.startTime,
          endTime: dto.endTime,
          durationMinutes: duration,
          bypassVenuePastStartCheck: true,
          adminCalendarSeriesId: dto.adminCalendarSeriesId ?? null,
        });
        created.push(result);
        const court = await this.courtRepo.findOne({
          where: { id: dto.courtId },
        });
        if (court?.locationId) {
          const sport = court.sports?.[0] ?? null;
          const courtType = court.courtTypes?.[0] ?? null;
          this.courtHoldGateway.broadcastCourtBookingMutated(court.locationId, {
            bookingDate: bookingDate.slice(0, 10),
            courtId: dto.courtId,
            sport,
            courtType,
          });
        }
      } catch (e: unknown) {
        let message = "Failed";
        if (e instanceof HttpException) {
          const r = e.getResponse();
          if (typeof r === "string") message = r;
          else if (typeof r === "object" && r && "message" in r) {
            const m = (r as { message: string | string[] }).message;
            message = Array.isArray(m) ? m.join(", ") : String(m);
          }
        } else if (e instanceof Error) message = e.message;
        errors.push({ bookingDate, message });
      }
    }

    if (dto.sendConfirmationEmail === true && created.length > 0) {
      void this.bookingMailService.sendAdminMultiDateBookingConfirmation(
        created.map((r) => r.id),
      );
    }

    return { created, errors };
  }

  async getCourtAvailability(
    courtId: string,
    date: string,
    slotMinutes?: number,
  ) {
    return this.courtBookingHandler.getAvailableSlots(
      courtId,
      date,
      slotMinutes ?? 60,
    );
  }

  /** Booking wizard: time windows for location + sport + indoor/outdoor. */
  getWizardWindows(userId: string, q: CourtWizardWindowsQueryDto) {
    return this.courtWizardAvailability.listBookingWindows(
      userId,
      q.locationId,
      q.sport,
      q.courtType,
    );
  }

  /** Booking wizard: slot grid + courts that still have a free slot. */
  getWizardAvailability(userId: string, q: CourtWizardAvailabilityQueryDto) {
    return this.courtWizardAvailability.computeWizardAvailability({
      userId,
      locationId: q.locationId,
      sport: q.sport,
      courtType: q.courtType,
      bookingDate: q.bookingDate,
      windowId: q.windowId,
      durationMinutes: q.durationMinutes,
    });
  }

  /** New flow: aggregate all windows, return slots with availableCount (no court names). */
  getAvailableSlots(userId: string, q: CourtSlotQueryDto) {
    return this.courtWizardAvailability.computeAvailableSlots({
      userId,
      locationId: q.locationId,
      areaId: q.areaId,
      sport: q.sport,
      courtType: q.courtType,
      bookingDate: q.bookingDate,
      durationMinutes: q.durationMinutes,
      excludeBookingId: q.excludeBookingId,
    });
  }

  /**
   * New booking flow: user picks a slot, system randomly assigns a free court.
   * Returns booking result + the assigned courtId (for internal reference).
   */
  async createSlotBooking(userId: string, dto: CreateCourtSlotBookingDto) {
    await this.assertAreaAccess(userId, dto.locationId, dto.areaId);
    await this.assertAtMostOneCourtBookingPerUserPerDay(
      userId,
      dto.bookingDate,
    );
    const qb = this.courtRepo
      .createQueryBuilder("c")
      .where("c.locationId = :locationId", { locationId: dto.locationId })
      .andWhere(":courtType = ANY(c.courtTypes)", {
        courtType: dto.courtType.toLowerCase(),
      })
      .andWhere("c.status = :status", { status: "active" })
      .andWhere(":sport = ANY(c.sports)", { sport: dto.sport.toLowerCase() });
    if (dto.areaId) {
      qb.andWhere("c.areaId = :areaId", { areaId: dto.areaId });
    }
    const courts = await qb.orderBy("c.name", "ASC").getMany();

    if (courts.length === 0) {
      throw new ConflictException(
        "No courts available for this location, sport, and court type.",
      );
    }

    // Shuffle courts (random order) to avoid always picking the same one
    const shuffled = courts.sort(() => Math.random() - 0.5);

    // Find the first available court for this slot
    let assignedCourtId: string | null = null;
    for (const court of shuffled) {
      const free = await this.courtBookingHandler.isCourtAvailable(
        court.id,
        dto.bookingDate,
        dto.startTime,
        dto.endTime,
      );
      if (free) {
        assignedCourtId = court.id;
        break;
      }
    }

    if (!assignedCourtId) {
      throw new ConflictException(
        "All courts are taken for this slot. Please pick another time.",
      );
    }

    const duration =
      dto.durationMinutes ??
      this.getDurationMinutes(dto.startTime, dto.endTime);
    const result = await this.courtBookingHandler.create({
      userId,
      courtId: assignedCourtId,
      bookingDate: dto.bookingDate,
      startTime: dto.startTime,
      endTime: dto.endTime,
      coachId: dto.coachId,
      durationMinutes: duration,
      sport: dto.sport,
    });
    void this.bookingMailService.sendBookingConfirmation(result.id, "created");
    this.courtHoldGateway.broadcastCourtBookingMutated(dto.locationId, {
      bookingDate: dto.bookingDate.slice(0, 10),
      courtId: assignedCourtId,
      sport: dto.sport,
      courtType: dto.courtType,
    });
    return result;
  }

  /** Update existing slot booking row (reschedule) — same payload shape as create slot. */
  async updateSlotBooking(
    userId: string,
    bookingId: string,
    dto: CreateCourtSlotBookingDto,
  ) {
    await this.assertAreaAccess(userId, dto.locationId, dto.areaId);
    await this.assertAtMostOneCourtBookingPerUserPerDay(
      userId,
      dto.bookingDate,
      bookingId,
    );
    const duration =
      dto.durationMinutes ??
      this.getDurationMinutes(dto.startTime, dto.endTime);
    const result = await this.courtBookingHandler.rescheduleSlotBooking(
      userId,
      bookingId,
      {
        locationId: dto.locationId,
        areaId: dto.areaId,
        sport: dto.sport,
        courtType: dto.courtType,
        bookingDate: dto.bookingDate,
        startTime: dto.startTime,
        endTime: dto.endTime,
        durationMinutes: duration,
      },
    );
    void this.bookingMailService.sendBookingConfirmation(
      result.id,
      "rescheduled",
    );
    this.courtHoldGateway.broadcastCourtBookingMutated(dto.locationId, {
      bookingDate: dto.bookingDate.slice(0, 10),
      sport: dto.sport,
      courtType: dto.courtType,
    });
    return result;
  }

  async checkCourtAvailability(
    courtId: string,
    date: Date,
    startTime: string,
    endTime: string,
  ) {
    return this.courtBookingHandler.isCourtAvailable(
      courtId,
      date,
      startTime,
      endTime,
    );
  }

  // ----- Coach session (book coach only or with court) -----

  async createCoachSession(userId: string, dto: CreateCoachSessionDto) {
    return this.coachSessionHandler.create({
      userId,
      coachId: dto.coachId,
      sessionDate: dto.sessionDate,
      startTime: dto.startTime,
      durationMinutes: dto.durationMinutes,
      courtId: dto.courtId,
      sessionType: dto.sessionType,
    });
  }

  // ----- Unified: cancel & list -----

  async cancelBooking(bookingId: string, kind: BookingKind, userId: string) {
    if (kind === "court") {
      const before = await this.courtBookingRepo.findOne({
        where: { id: bookingId },
      });
      await this.courtBookingHandler.cancel(bookingId, userId);
      void this.bookingMailService.sendBookingCancellation(bookingId);
      if (before?.locationId) {
        const d =
          before.bookingDate instanceof Date
            ? before.bookingDate.toISOString().slice(0, 10)
            : String(before.bookingDate).slice(0, 10);
        this.courtHoldGateway.broadcastCourtBookingMutated(before.locationId, {
          bookingDate: d,
          courtId: before.courtId,
          sport: before.sport,
          courtType: before.courtType,
        });
      }
    } else {
      await this.coachSessionHandler.cancel(bookingId, userId);
    }
  }

  // ----- Admin: list & update all court bookings -----

  async adminListCourtBookings(q: AdminListCourtBookingsQueryDto) {
    const qb = this.courtBookingRepo
      .createQueryBuilder("b")
      .leftJoinAndSelect("b.court", "court")
      .leftJoinAndSelect("b.user", "user")
      .leftJoinAndSelect("b.location", "location")
      .orderBy("b.bookingDate", "DESC")
      .addOrderBy("b.startTime", "DESC");

    if (q.locationId)
      qb.andWhere("b.locationId = :locationId", { locationId: q.locationId });
    if (q.status) qb.andWhere("b.bookingStatus = :st", { st: q.status });
    if (q.paymentStatus)
      qb.andWhere("b.paymentStatus = :ps", { ps: q.paymentStatus });
    if (q.from) qb.andWhere("b.bookingDate >= :from", { from: q.from });
    if (q.to) qb.andWhere("b.bookingDate <= :to", { to: q.to });
    if (q.search?.trim()) {
      const s = `%${q.search.trim().toLowerCase()}%`;
      qb.andWhere(
        "(LOWER(user.email) LIKE :s OR LOWER(user.fullName) LIKE :s OR LOWER(court.name) LIKE :s)",
        { s },
      );
    }

    const data = await qb.getMany();
    return data;
  }

  async adminUpdateCourtBooking(id: string, dto: AdminUpdateCourtBookingDto) {
    const hasSchedule =
      dto.bookingDate != null || dto.startTime != null || dto.endTime != null;
    if (hasSchedule) {
      if (!dto.bookingDate || !dto.startTime || !dto.endTime) {
        throw new BadRequestException(
          "To reschedule, provide bookingDate, startTime, and endTime together",
        );
      }
      const before = await this.courtBookingRepo.findOne({ where: { id } });
      if (!before) throw new NotFoundException("Booking not found");
      await this.assertAtMostOneCourtBookingPerUserPerDay(
        before.userId,
        dto.bookingDate,
        id,
      );
      await this.courtBookingHandler.adminRescheduleCourtBooking(id, {
        bookingDate: dto.bookingDate,
        startTime: dto.startTime,
        endTime: dto.endTime,
      });
      const court = await this.courtRepo.findOne({
        where: { id: before.courtId },
      });
      if (court?.locationId) {
        this.courtHoldGateway.broadcastCourtBookingMutated(court.locationId, {
          bookingDate: dto.bookingDate.slice(0, 10),
          courtId: before.courtId,
          sport: court.sports?.[0] ?? null,
          courtType: court.courtTypes?.[0] ?? null,
        });
      }
    }

    const row = await this.courtBookingRepo.findOne({
      where: { id },
      relations: { court: true, user: true, location: true },
    });
    if (!row) throw new NotFoundException("Booking not found");

    if (dto.bookingStatus !== undefined) {
      row.bookingStatus = dto.bookingStatus as any;
    }
    if (dto.paymentStatus !== undefined) {
      row.paymentStatus = dto.paymentStatus as any;
    }
    await this.courtBookingRepo.save(row);
    return row;
  }

  async adminCancelCourtBooking(id: string) {
    const before = await this.courtBookingRepo.findOne({ where: { id } });
    const updated = await this.courtBookingHandler.adminCancelCourtBooking(id);
    void this.bookingMailService.sendBookingCancellation(id);
    if (before?.locationId) {
      const d =
        before.bookingDate instanceof Date
          ? before.bookingDate.toISOString().slice(0, 10)
          : String(before.bookingDate).slice(0, 10);
      const court = await this.courtRepo.findOne({
        where: { id: before.courtId },
      });
      this.courtHoldGateway.broadcastCourtBookingMutated(before.locationId, {
        bookingDate: d,
        courtId: before.courtId,
        sport: court?.sports?.[0] ?? before.sport ?? null,
        courtType: court?.courtTypes?.[0] ?? before.courtType ?? null,
      });
    }
    return updated;
  }

  /**
   * Admin: cancel every non-terminal court row sharing the same calendar series (recurring / multi-date).
   * Does not send per-booking emails (bulk administrative action).
   */
  async adminCancelCourtBookingSeries(seriesId: string) {
    const rows = await this.courtBookingRepo.find({
      where: {
        adminCalendarSeriesId: seriesId,
        bookingStatus: In([
          CourtBookingStatus.PENDING,
          CourtBookingStatus.CONFIRMED,
        ]),
      },
      relations: { court: true },
    });
    if (!rows.length) {
      throw new NotFoundException("No active bookings found for this series");
    }
    const locationIds = new Set<string>();
    for (const row of rows) {
      row.bookingStatus = CourtBookingStatus.CANCELLED;
      if (row.locationId) locationIds.add(row.locationId);
    }
    await this.courtBookingRepo.save(rows);
    for (const locationId of locationIds) {
      const sample = rows.find((r) => r.locationId === locationId);
      const d =
        sample?.bookingDate instanceof Date
          ? sample.bookingDate.toISOString().slice(0, 10)
          : String(sample?.bookingDate).slice(0, 10);
      const court = sample?.courtId
        ? await this.courtRepo.findOne({ where: { id: sample.courtId } })
        : null;
      this.courtHoldGateway.broadcastCourtBookingMutated(locationId, {
        bookingDate: d,
        courtId: sample?.courtId,
        sport: court?.sports?.[0] ?? sample?.sport ?? null,
        courtType: court?.courtTypes?.[0] ?? sample?.courtType ?? null,
      });
    }
    return { cancelledCount: rows.length };
  }

  async findBooking(bookingId: string, kind: BookingKind) {
    if (kind === "court") {
      const b = await this.courtBookingHandler.findOne(bookingId);
      if (!b) throw new NotFoundException("Court booking not found");
      return { kind: "court" as const, data: b };
    } else {
      const s = await this.coachSessionHandler.findOne(bookingId);
      if (!s) throw new NotFoundException("Coach session not found");
      return { kind: "coach" as const, data: s };
    }
  }

  /** List all bookings for a user (court + coach sessions). */
  async findMyBookings(userId: string, from?: string, to?: string) {
    const fromDate = from ? new Date(from) : undefined;
    const toDate = to ? new Date(to) : undefined;
    const [courtBookings, coachSessions] = await Promise.all([
      this.courtBookingHandler.findByUser(userId, fromDate, toDate),
      this.coachSessionHandler.findByUser(userId, fromDate, toDate),
    ]);
    return {
      courtBookings,
      coachSessions,
    };
  }

  private getDurationMinutes(start: string, end: string): number {
    const [sh, sm] = start.split(":").map(Number);
    const [eh, em] = end.split(":").map(Number);
    return eh * 60 + em - (sh * 60 + sm);
  }
}
