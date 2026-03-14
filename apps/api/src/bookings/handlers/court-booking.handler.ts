import {
  Injectable,
  BadRequestException,
  NotFoundException,
  ForbiddenException,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import {
  CourtBooking,
  CourtBookingType,
  CourtBookingStatus,
  PaymentStatus,
} from "../entities/court-booking.entity";
import { Court } from "../../courts/entities/court.entity";
import { Coach } from "../../coaches/entities/coach.entity";
import {
  IBookingHandler,
  CreateBookingParams,
  CreateBookingResult,
  BookingKind,
} from "../interfaces/booking-handler.interface";
import { CourtsService } from "../../courts/courts.service";
import { CoachesService } from "../../coaches/coaches.service";

export interface CourtBookingCreateParams extends CreateBookingParams {
  courtId: string;
  bookingDate: string;
  startTime: string;
  endTime: string;
  coachId?: string;
  durationMinutes?: number;
}

@Injectable()
export class CourtBookingHandler implements IBookingHandler {
  readonly kind: BookingKind = "court";

  constructor(
    @InjectRepository(CourtBooking)
    private readonly courtBookingRepo: Repository<CourtBooking>,
    private readonly courtsService: CourtsService,
    private readonly coachesService: CoachesService,
  ) {}

  private parseTimeToMinutes(time: string): number {
    const [h, m] = time.split(":").map(Number);
    return h * 60 + m;
  }

  private formatTime(minutes: number): string {
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
  }

  /** Check if court is free for given slot (no overlapping pending/confirmed). */
  async isCourtAvailable(
    courtId: string,
    date: Date,
    startTime: string,
    endTime: string,
    excludeBookingId?: string,
  ): Promise<boolean> {
    const dateStr =
      date instanceof Date ? date.toISOString().slice(0, 10) : String(date).slice(0, 10);
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
    return count === 0;
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
      const available = await this.isCourtAvailable(
        courtId,
        new Date(date),
        start,
        end,
      );
      if (available) slots.push({ start, end });
      min += slotMinutes;
    }
    return slots;
  }

  async create(params: CreateBookingParams): Promise<CreateBookingResult> {
    const p = params as CourtBookingCreateParams;
    const court = await this.courtsService.findOne(p.courtId);
    if (court.status !== "active") {
      throw new BadRequestException("Court is not available for booking");
    }

    const startMin = this.parseTimeToMinutes(p.startTime);
    const endMin = this.parseTimeToMinutes(p.endTime);
    if (endMin <= startMin) {
      throw new BadRequestException("endTime must be after startTime");
    }
    const durationMinutes = p.durationMinutes ?? endMin - startMin;

    const available = await this.isCourtAvailable(
      p.courtId,
      new Date(p.bookingDate),
      p.startTime,
      p.endTime,
    );
    if (!available) {
      throw new BadRequestException(
        "Court is not available for the selected time slot",
      );
    }

    let coachId: string | null = null;
    let bookingType = CourtBookingType.COURT_ONLY;
    let totalPrice = parseFloat(court.pricePerHour) * (durationMinutes / 60);

    if (p.coachId) {
      const coach = await this.coachesService.findOne(p.coachId);
      coachId = coach.id;
      bookingType = CourtBookingType.COURT_COACH;
      totalPrice += parseFloat(coach.hourlyRate) * (durationMinutes / 60);
    }

    const booking = this.courtBookingRepo.create({
      organizationId: p.organizationId ?? null,
      branchId: p.branchId ?? court.branchId,
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

    const saved = await this.courtBookingRepo.save(booking);
    return {
      id: saved.id,
      kind: "court",
      summary: `Court ${court.name} on ${p.bookingDate} ${p.startTime}-${p.endTime}${coachId ? " with coach" : ""}`,
    };
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
