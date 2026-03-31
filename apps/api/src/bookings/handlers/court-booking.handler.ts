import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { InjectDataSource, InjectRepository } from "@nestjs/typeorm";
import { DataSource, QueryFailedError, Repository } from "typeorm";
import { CoachesService } from "../../coaches/coaches.service";
import { CourtsService } from "../../courts/courts.service";
import { LocationVisibility } from "../../locations/entities/location.enums";
import { UserLocationMembership } from "../../memberships/entities/user-location-membership.entity";
import { LocationsService } from "../../locations/locations.service";
import {
  CourtBooking,
  CourtBookingStatus,
  CourtBookingType,
  CourtPricingTier,
  PaymentStatus,
} from "../entities/court-booking.entity";
import {
  CoachSession,
  CoachSessionStatus,
} from "../entities/coach-session.entity";
import {
  BookingKind,
  CreateBookingParams,
  CreateBookingResult,
  IBookingHandler,
} from "../interfaces/booking-handler.interface";
import { Location } from "../../locations/entities/location.entity";
import { Court } from "../../courts/entities/court.entity";
import { courtSupportsSport } from "../../courts/court-sports.util";
import {
  wallClockMinutesNowInTimeZone,
  ymdTodayInIanaTimeZone,
} from "../utils/location-booking-dates";

export interface CourtBookingCreateParams extends CreateBookingParams {
  courtId: string;
  bookingDate: string;
  startTime: string;
  endTime: string;
  coachId?: string;
  durationMinutes?: number;
  /** Optional: link row to `location_booking_windows` when using wizard flow */
  locationBookingWindowId?: string;
  /** Activity booked (must be in court.sports when set) */
  sport?: string;
}

function parseHourlyMemberRate(court: Court, location: Location): number {
  const publicRate = parseFloat(court.pricePerHourPublic);
  if (
    court.pricePerHourMember != null &&
    court.pricePerHourMember !== "" &&
    !Number.isNaN(parseFloat(court.pricePerHourMember))
  ) {
    return parseFloat(court.pricePerHourMember);
  }
  const pct = Math.min(100, Math.max(0, location.memberCourtDiscountPercent));
  return publicRate * (1 - pct / 100);
}

@Injectable()
export class CourtBookingHandler implements IBookingHandler {
  readonly kind: BookingKind = "court";

  constructor(
    @InjectRepository(CourtBooking)
    private readonly courtBookingRepo: Repository<CourtBooking>,
    @InjectRepository(CoachSession)
    private readonly coachSessionRepo: Repository<CoachSession>,
    private readonly courtsService: CourtsService,
    private readonly coachesService: CoachesService,
    private readonly locationsService: LocationsService,
    @InjectDataSource()
    private readonly dataSource: DataSource,
  ) {}

  /**
   * Wall-clock date+time in location TZ → UTC instants (Postgres rules, DST-safe).
   */
  private async wallRangeToUtc(
    bookingDate: string,
    startTime: string,
    endTime: string,
    ianaTimezone: string,
  ): Promise<{ start: Date; end: Date }> {
    const d = bookingDate.slice(0, 10);
    const pad = (t: string) => (t.length <= 5 ? `${t}:00` : t);
    const rows = (await this.dataSource.query(
      `SELECT
        (($1::text || ' ' || $2::text)::timestamp AT TIME ZONE $3) AS "startAt",
        (($1::text || ' ' || $4::text)::timestamp AT TIME ZONE $3) AS "endAt"`,
      [d, pad(startTime), ianaTimezone, pad(endTime)],
    )) as { startAt: Date; endAt: Date }[];
    return { start: rows[0].startAt, end: rows[0].endAt };
  }

  private isOverlapConstraintViolation(err: unknown): boolean {
    if (!(err instanceof QueryFailedError)) return false;
    const code = (err as QueryFailedError & { driverError?: { code?: string } })
      .driverError?.code;
    /** 23P01 = exclusion_violation; 23505 = unique_violation (if you add a surrogate unique key). */
    return code === "23P01" || code === "23505";
  }

  private parseTimeToMinutes(time: string): number {
    const [h, m] = time.split(":").map(Number);
    return h * 60 + m;
  }

  private formatTime(minutes: number): string {
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
  }

  /** Check if court is free for given slot (no overlapping pending/confirmed bookings or coach sessions on this court). */
  async isCourtAvailable(
    courtId: string,
    bookingDate: Date | string,
    startTime: string,
    endTime: string,
    excludeBookingId?: string,
  ): Promise<boolean> {
    const dateStr =
      typeof bookingDate === "string"
        ? bookingDate.slice(0, 10)
        : bookingDate instanceof Date
          ? bookingDate.toISOString().slice(0, 10)
          : String(bookingDate).slice(0, 10);
    const qb = this.courtBookingRepo
      .createQueryBuilder("b")
      .where("b.courtId = :courtId", { courtId })
      .andWhere("b.bookingDate = :date", { date: dateStr })
      .andWhere("b.bookingStatus IN (:...statuses)", {
        statuses: [CourtBookingStatus.PENDING, CourtBookingStatus.CONFIRMED],
      })
      .andWhere("(b.startTime < :endTime AND b.endTime > :startTime)", {
        startTime,
        endTime,
      });
    if (excludeBookingId) {
      qb.andWhere("b.id != :excludeId", { excludeId: excludeBookingId });
    }
    const count = await qb.getCount();
    if (count > 0) {
      return false;
    }

    /** Coach sessions that reserve this court must block the same wall-clock slot. */
    const sessions = await this.coachSessionRepo
      .createQueryBuilder("s")
      .where("s.courtId = :courtId", { courtId })
      .andWhere("s.sessionDate = :date", { date: dateStr })
      .andWhere("s.status = :status", {
        status: CoachSessionStatus.SCHEDULED,
      })
      .getMany();

    const bStart = this.parseTimeToMinutes(startTime);
    const bEnd = this.parseTimeToMinutes(endTime);
    for (const s of sessions) {
      const sStart = this.parseTimeToMinutes(s.startTime);
      const sEnd = sStart + s.durationMinutes;
      if (sStart < bEnd && sEnd > bStart) {
        return false;
      }
    }

    return true;
  }

  /** Get available time slots for a court on a date. */
  async getAvailableSlots(
    courtId: string,
    date: string,
    slotMinutes = 60,
  ): Promise<{ start: string; end: string }[]> {
    await this.courtsService.findOne(courtId);
    const dayStart = "07:00";
    const dayEnd = "22:00";
    const slots: { start: string; end: string }[] = [];
    const [sh, sm] = dayStart.split(":").map(Number);
    const [eh, em] = dayEnd.split(":").map(Number);
    let min = sh * 60 + sm;
    const endMin = eh * 60 + em;
    while (min + slotMinutes <= endMin) {
      const start = this.formatTime(min);
      const end = this.formatTime(min + slotMinutes);
      const available = await this.isCourtAvailable(courtId, date, start, end);
      if (available) slots.push({ start, end });
      min += slotMinutes;
    }
    return slots;
  }

  async create(params: CreateBookingParams): Promise<CreateBookingResult> {
    const p = params as CourtBookingCreateParams;
    const courtPayload = await this.courtsService.findOne(p.courtId);
    const { coaches: _coaches, pricePerHour: _legacy, ...court } = courtPayload;
    if (court.status !== "active") {
      throw new BadRequestException("Court is not available for booking");
    }
    const location = court.location;
    if (!location) {
      throw new BadRequestException("Court has no location");
    }

    const startMin = this.parseTimeToMinutes(p.startTime);
    const endMin = this.parseTimeToMinutes(p.endTime);
    if (endMin <= startMin) {
      throw new BadRequestException("endTime must be after startTime");
    }
    const durationMinutes = p.durationMinutes ?? endMin - startMin;

    const dateStr = p.bookingDate.slice(0, 10);
    const todayYmd = ymdTodayInIanaTimeZone(location.timezone);
    if (dateStr < todayYmd) {
      throw new BadRequestException("Cannot book a past date at this venue");
    }
    if (dateStr === todayYmd) {
      const nowMin = wallClockMinutesNowInTimeZone(location.timezone);
      if (startMin < nowMin) {
        throw new BadRequestException(
          "This start time has already passed at the venue",
        );
      }
    }

    const available = await this.isCourtAvailable(
      p.courtId,
      p.bookingDate,
      p.startTime,
      p.endTime,
    );
    if (!available) {
      throw new BadRequestException(
        "Court is not available for the selected time slot",
      );
    }

    const sportSnapshot =
      p.sport?.trim().toLowerCase() ?? court.sports?.[0] ?? "tennis";
    if (!courtSupportsSport(court, sportSnapshot)) {
      throw new BadRequestException(
        "This court is not configured for the selected sport",
      );
    }

    let membership: UserLocationMembership | null = null;
    if (location.visibility === LocationVisibility.PRIVATE) {
      membership =
        await this.locationsService.requirePrivateVenueMembershipForBooking(
          p.userId,
          location.id,
        );
    }

    const pricingTier =
      location.visibility === LocationVisibility.PRIVATE
        ? CourtPricingTier.MEMBER
        : CourtPricingTier.PUBLIC;

    const publicHourly = parseFloat(court.pricePerHourPublic);
    let courtHourly = publicHourly;
    let discountAmountNum: number | null = null;
    const unitSnapshot = publicHourly.toFixed(2);

    if (pricingTier === CourtPricingTier.MEMBER) {
      courtHourly = parseHourlyMemberRate(court, location);
      const hours = durationMinutes / 60;
      discountAmountNum = Math.max(
        0,
        publicHourly * hours - courtHourly * hours,
      );
    }

    let coachId: string | null = null;
    let bookingType = CourtBookingType.COURT_ONLY;
    let totalPrice = courtHourly * (durationMinutes / 60);

    if (p.coachId) {
      const coach = await this.coachesService.findOne(p.coachId);
      coachId = coach.id;
      bookingType = CourtBookingType.COURT_COACH;
      totalPrice += parseFloat(coach.hourlyRate) * (durationMinutes / 60);
    }

    const { start: bookingStartAt, end: bookingEndAt } =
      await this.wallRangeToUtc(
        p.bookingDate,
        p.startTime,
        p.endTime,
        location.timezone,
      );

    const booking = this.courtBookingRepo.create({
      locationId: location.id,
      sport: sportSnapshot,
      courtType: court.type,
      locationBookingWindowId: p.locationBookingWindowId ?? null,
      pricingTier,
      unitPricePerHourSnapshot: unitSnapshot,
      discountAmount:
        discountAmountNum != null ? discountAmountNum.toFixed(2) : null,
      userLocationMembershipId: membership?.id ?? null,
      bookingStartAt,
      bookingEndAt,
      courtId: p.courtId,
      userId: p.userId,
      coachId,
      bookingType,
      bookingDate: new Date(p.bookingDate),
      startTime: p.startTime,
      endTime: p.endTime,
      durationMinutes,
      totalPrice: String(totalPrice.toFixed(2)),
      paymentStatus: PaymentStatus.UNPAID,
      bookingStatus: CourtBookingStatus.CONFIRMED,
    });

    let saved: CourtBooking;
    try {
      saved = await this.courtBookingRepo.save(booking);
    } catch (e) {
      if (this.isOverlapConstraintViolation(e)) {
        throw new ConflictException(
          "That slot was just taken. Please pick another time or court.",
        );
      }
      throw e;
    }
    return {
      id: saved.id,
      kind: "court",
      summary: `Court ${court.name} on ${p.bookingDate} ${p.startTime}-${p.endTime}${coachId ? " with coach" : ""}`,
    };
  }

  /**
   * Reschedule an existing slot booking (same row): new time/slot, possibly new court.
   * Only `COURT_ONLY` without coach — same constraints as slot create.
   */
  async rescheduleSlotBooking(
    userId: string,
    bookingId: string,
    dto: {
      locationId: string;
      areaId?: string;
      sport: string;
      courtType: string;
      bookingDate: string;
      startTime: string;
      endTime: string;
      durationMinutes: number;
    },
  ): Promise<CreateBookingResult> {
    const booking = await this.courtBookingRepo.findOne({
      where: { id: bookingId },
      relations: { court: { location: true } },
    });
    if (!booking) throw new NotFoundException("Booking not found");
    if (booking.userId !== userId) {
      throw new ForbiddenException("You can only edit your own booking");
    }
    if (booking.coachId) {
      throw new BadRequestException(
        "Bookings with a coach cannot be rescheduled here",
      );
    }
    if (booking.bookingType !== CourtBookingType.COURT_ONLY) {
      throw new BadRequestException("Only court-only bookings can be rescheduled here");
    }
    if (
      booking.bookingStatus === CourtBookingStatus.CANCELLED ||
      booking.bookingStatus === CourtBookingStatus.COMPLETED
    ) {
      throw new BadRequestException("This booking cannot be rescheduled");
    }
    if (booking.locationId !== dto.locationId) {
      throw new BadRequestException("Cannot move a booking to another location");
    }

    const location = booking.court?.location;
    if (!location) {
      throw new BadRequestException("Court has no location");
    }

    const courtRepo = this.dataSource.getRepository(Court);
    const qb = courtRepo
      .createQueryBuilder("c")
      .where("c.locationId = :locationId", { locationId: dto.locationId })
      .andWhere("c.type = :courtType", { courtType: dto.courtType })
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

    const shuffled = [...courts].sort(() => Math.random() - 0.5);
    let assignedCourtId: string | null = null;
    for (const c of shuffled) {
      const free = await this.isCourtAvailable(
        c.id,
        dto.bookingDate,
        dto.startTime,
        dto.endTime,
        bookingId,
      );
      if (free) {
        assignedCourtId = c.id;
        break;
      }
    }
    if (!assignedCourtId) {
      throw new ConflictException(
        "All courts are taken for this slot. Please pick another time.",
      );
    }

    const courtPayload = await this.courtsService.findOne(assignedCourtId);
    const { coaches: _coaches, pricePerHour: _legacy, ...court } = courtPayload;
    if (court.status !== "active") {
      throw new BadRequestException("Court is not available for booking");
    }
    const loc = court.location;
    if (!loc) throw new BadRequestException("Court has no location");

    const startMin = this.parseTimeToMinutes(dto.startTime);
    const endMin = this.parseTimeToMinutes(dto.endTime);
    if (endMin <= startMin) {
      throw new BadRequestException("endTime must be after startTime");
    }
    const durationMinutes =
      dto.durationMinutes ?? endMin - startMin;

    const dateStr = dto.bookingDate.slice(0, 10);
    const todayYmd = ymdTodayInIanaTimeZone(loc.timezone);
    if (dateStr < todayYmd) {
      throw new BadRequestException("Cannot book a past date at this venue");
    }
    if (dateStr === todayYmd) {
      const nowMin = wallClockMinutesNowInTimeZone(loc.timezone);
      if (startMin < nowMin) {
        throw new BadRequestException(
          "This start time has already passed at the venue",
        );
      }
    }

    let membership: UserLocationMembership | null = null;
    if (loc.visibility === LocationVisibility.PRIVATE) {
      membership =
        await this.locationsService.requirePrivateVenueMembershipForBooking(
          userId,
          loc.id,
        );
    }

    const pricingTier =
      loc.visibility === LocationVisibility.PRIVATE
        ? CourtPricingTier.MEMBER
        : CourtPricingTier.PUBLIC;

    const publicHourly = parseFloat(court.pricePerHourPublic);
    let courtHourly = publicHourly;
    let discountAmountNum: number | null = null;
    const unitSnapshot = publicHourly.toFixed(2);

    if (pricingTier === CourtPricingTier.MEMBER) {
      courtHourly = parseHourlyMemberRate(court, loc);
      const hours = durationMinutes / 60;
      discountAmountNum = Math.max(
        0,
        publicHourly * hours - courtHourly * hours,
      );
    }

    const totalPrice = courtHourly * (durationMinutes / 60);

    const { start: bookingStartAt, end: bookingEndAt } =
      await this.wallRangeToUtc(
        dto.bookingDate,
        dto.startTime,
        dto.endTime,
        loc.timezone,
      );

    booking.locationId = loc.id;
    booking.sport = dto.sport;
    booking.courtType = dto.courtType;
    booking.locationBookingWindowId = null;
    booking.pricingTier = pricingTier;
    booking.unitPricePerHourSnapshot = unitSnapshot;
    booking.discountAmount =
      discountAmountNum != null ? discountAmountNum.toFixed(2) : null;
    booking.userLocationMembershipId = membership?.id ?? null;
    booking.bookingStartAt = bookingStartAt;
    booking.bookingEndAt = bookingEndAt;
    booking.courtId = assignedCourtId;
    booking.bookingDate = new Date(dto.bookingDate);
    booking.startTime = dto.startTime;
    booking.endTime = dto.endTime;
    booking.durationMinutes = durationMinutes;
    booking.totalPrice = String(totalPrice.toFixed(2));
    booking.reminder30EmailSentAt = null;

    try {
      const saved = await this.courtBookingRepo.save(booking);
      return {
        id: saved.id,
        kind: "court",
        summary: `Court ${court.name} on ${dto.bookingDate} ${dto.startTime}-${dto.endTime}`,
      };
    } catch (e) {
      if (this.isOverlapConstraintViolation(e)) {
        throw new ConflictException(
          "That slot was just taken. Please pick another time or court.",
        );
      }
      throw e;
    }
  }

  async cancel(bookingId: string, userId: string): Promise<void> {
    const booking = await this.courtBookingRepo.findOne({
      where: { id: bookingId },
      relations: { court: true },
    });
    if (!booking) throw new NotFoundException("Booking not found");
    if (booking.userId !== userId) {
      throw new ForbiddenException("You can only cancel your own booking");
    }
    if (
      booking.bookingStatus === CourtBookingStatus.CANCELLED ||
      booking.bookingStatus === CourtBookingStatus.COMPLETED
    ) {
      throw new BadRequestException("Booking cannot be cancelled");
    }
    booking.bookingStatus = CourtBookingStatus.CANCELLED;
    await this.courtBookingRepo.save(booking);
  }

  async findOne(bookingId: string): Promise<CourtBooking | null> {
    return this.courtBookingRepo.findOne({
      where: { id: bookingId },
      relations: { court: true, user: true, coach: true },
    });
  }

  async findByUser(
    userId: string,
    from?: Date,
    to?: Date,
  ): Promise<CourtBooking[]> {
    const qb = this.courtBookingRepo
      .createQueryBuilder("b")
      .leftJoinAndSelect("b.court", "court")
      .leftJoinAndSelect("b.coach", "coach")
      .where("b.userId = :userId", { userId })
      .andWhere("b.bookingStatus != :cancelled", {
        cancelled: CourtBookingStatus.CANCELLED,
      })
      .orderBy("b.bookingDate", "ASC")
      .addOrderBy("b.startTime", "ASC");
    if (from) {
      qb.andWhere("b.bookingDate >= :from", {
        from: from.toISOString().slice(0, 10),
      });
    }
    if (to) {
      qb.andWhere("b.bookingDate <= :to", {
        to: to.toISOString().slice(0, 10),
      });
    }
    return qb.getMany();
  }
}
