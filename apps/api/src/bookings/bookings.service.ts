import { Injectable, NotFoundException } from "@nestjs/common";
import { CourtBookingHandler } from "./handlers/court-booking.handler";
import { CoachSessionHandler } from "./handlers/coach-session.handler";
import { CourtWizardAvailabilityService } from "./court-wizard-availability.service";
import { CreateCourtBookingDto } from "./dto/create-court-booking.dto";
import { CreateCoachSessionDto } from "./dto/create-coach-session.dto";
import {
  CourtWizardAvailabilityQueryDto,
  CourtWizardWindowsQueryDto,
} from "./dto/court-wizard-query.dto";
import { BookingKind } from "./interfaces/booking-handler.interface";

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
  ) {}

  // ----- Court booking (sân, optional coach) -----

  async createCourtBooking(
    userId: string,
    dto: CreateCourtBookingDto,
    organizationId?: string | null,
    branchId?: string | null,
  ) {
    const duration =
      dto.durationMinutes ??
      this.getDurationMinutes(dto.startTime, dto.endTime);
    return this.courtBookingHandler.create({
      userId,
      organizationId: organizationId ?? null,
      branchId: branchId ?? null,
      courtId: dto.courtId,
      bookingDate: dto.bookingDate,
      startTime: dto.startTime,
      endTime: dto.endTime,
      coachId: dto.coachId,
      durationMinutes: duration,
      locationBookingWindowId: dto.locationBookingWindowId,
    });
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

  async createCoachSession(
    userId: string,
    dto: CreateCoachSessionDto,
    organizationId?: string | null,
    branchId?: string | null,
  ) {
    return this.coachSessionHandler.create({
      userId,
      organizationId: organizationId ?? null,
      branchId: branchId ?? null,
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
      await this.courtBookingHandler.cancel(bookingId, userId);
    } else {
      await this.coachSessionHandler.cancel(bookingId, userId);
    }
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
