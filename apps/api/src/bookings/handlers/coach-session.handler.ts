import {
  Injectable,
  BadRequestException,
  NotFoundException,
  ForbiddenException,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import {
  CoachSession,
  CoachSessionType,
  CoachSessionStatus,
} from "../entities/coach-session.entity";
import { CoachesService } from "../../coaches/coaches.service";
import { CourtsService } from "../../courts/courts.service";
import {
  IBookingHandler,
  CreateBookingParams,
  CreateBookingResult,
  BookingKind,
} from "../interfaces/booking-handler.interface";

export interface CoachSessionCreateParams extends CreateBookingParams {
  coachId: string;
  sessionDate: string;
  startTime: string;
  durationMinutes: number;
  courtId?: string;
  sessionType?: string;
  bookedById?: string;
}

@Injectable()
export class CoachSessionHandler implements IBookingHandler {
  readonly kind: BookingKind = "coach";

  constructor(
    @InjectRepository(CoachSession)
    private readonly coachSessionRepo: Repository<CoachSession>,
    private readonly coachesService: CoachesService,
    private readonly courtsService: CourtsService,
  ) {}

  /** Check if coach is free for given slot. */
  async isCoachAvailable(
    coachId: string,
    date: Date,
    startTime: string,
    durationMinutes: number,
    excludeSessionId?: string,
  ): Promise<boolean> {
    const dateStr =
      date instanceof Date
        ? date.toISOString().slice(0, 10)
        : String(date).slice(0, 10);
    const [sh, sm] = startTime.split(":").map(Number);
    const startMin = sh * 60 + sm;
    const endMin = startMin + durationMinutes;

    const overlapping = await this.coachSessionRepo
      .createQueryBuilder("s")
      .where("s.coachId = :coachId", { coachId })
      .andWhere("s.sessionDate = :date", { date: dateStr })
      .andWhere("s.status = :status", { status: CoachSessionStatus.SCHEDULED })
      .getMany();

    for (const s of overlapping) {
      if (excludeSessionId && s.id === excludeSessionId) continue;
      const [sH, sM] = s.startTime.split(":").map(Number);
      const sStart = sH * 60 + sM;
      const sEnd = sStart + s.durationMinutes;
      if (startMin < sEnd && endMin > sStart) return false;
    }
    return true;
  }

  async create(params: CreateBookingParams): Promise<CreateBookingResult> {
    const p = params as CoachSessionCreateParams;

    const available = await this.isCoachAvailable(
      p.coachId,
      new Date(p.sessionDate),
      p.startTime,
      p.durationMinutes,
    );
    if (!available) {
      throw new BadRequestException(
        "Coach is not available for the selected time slot",
      );
    }

    let courtId: string | null = null;
    let branchId: string | null = p.branchId ?? null;
    if (p.courtId) {
      const court = await this.courtsService.findOne(p.courtId);
      courtId = court.id;
      branchId = court.location?.branchId ?? null;
    }

    const session = this.coachSessionRepo.create({
      organizationId: p.organizationId ?? null,
      branchId,
      coachId: p.coachId,
      courtId,
      bookedById: p.userId ?? p.bookedById ?? null,
      sessionDate: new Date(p.sessionDate),
      startTime: p.startTime,
      durationMinutes: p.durationMinutes,
      sessionType:
        (p.sessionType as CoachSessionType) ?? CoachSessionType.PRIVATE,
      status: CoachSessionStatus.SCHEDULED,
    });

    const saved = await this.coachSessionRepo.save(session);
    return {
      id: saved.id,
      kind: "coach",
      summary: `Coach session on ${p.sessionDate} ${p.startTime} (${p.durationMinutes} min)${courtId ? " with court" : ""}`,
    };
  }

  async cancel(bookingId: string, userId: string): Promise<void> {
    const session = await this.coachSessionRepo.findOne({
      where: { id: bookingId },
      relations: { coach: true },
    });
    if (!session) throw new NotFoundException("Session not found");
    if (session.bookedById && session.bookedById !== userId) {
      throw new ForbiddenException("You can only cancel your own session");
    }
    if (session.status !== CoachSessionStatus.SCHEDULED) {
      throw new BadRequestException("Session cannot be cancelled");
    }
    session.status = CoachSessionStatus.CANCELLED;
    await this.coachSessionRepo.save(session);
  }

  async findOne(bookingId: string): Promise<CoachSession | null> {
    return this.coachSessionRepo.findOne({
      where: { id: bookingId },
      relations: { coach: true, court: true },
    });
  }

  async findByUser(
    userId: string,
    from?: Date,
    to?: Date,
  ): Promise<CoachSession[]> {
    const qb = this.coachSessionRepo
      .createQueryBuilder("s")
      .leftJoinAndSelect("s.coach", "coach")
      .leftJoinAndSelect("s.court", "court")
      .where("s.bookedById = :userId", { userId })
      .andWhere("s.status = :status", { status: CoachSessionStatus.SCHEDULED })
      .orderBy("s.sessionDate", "ASC")
      .addOrderBy("s.startTime", "ASC");
    if (from) {
      qb.andWhere("s.sessionDate >= :from", {
        from: from.toISOString().slice(0, 10),
      });
    }
    if (to) {
      qb.andWhere("s.sessionDate <= :to", {
        to: to.toISOString().slice(0, 10),
      });
    }
    return qb.getMany();
  }
}
