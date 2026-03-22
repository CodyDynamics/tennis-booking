import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { Location } from "../locations/entities/location.entity";
import { LocationVisibility } from "../locations/entities/location.enums";
import { LocationBookingWindow } from "../locations/entities/location-booking-window.entity";
import { Court } from "../courts/entities/court.entity";
import {
  CourtBooking,
  CourtBookingStatus,
} from "./entities/court-booking.entity";
import {
  CoachSession,
  CoachSessionStatus,
} from "./entities/coach-session.entity";
import { MembershipStatus } from "../memberships/entities/membership.enums";
import { UserLocationMembership } from "../memberships/entities/user-location-membership.entity";
import {
  wallClockMinutesNowInTimeZone,
  ymdTodayInIanaTimeZone,
} from "./utils/location-booking-dates";

export interface BookingWindowDto {
  id: string;
  locationId: string;
  sport: string;
  courtType: string;
  windowStartTime: string;
  windowEndTime: string;
  allowedDurationMinutes: number[];
  slotGridMinutes: number;
  sortOrder: number;
}

export interface WizardCourtSummary {
  id: string;
  name: string;
  type: string;
  sport: string;
  status: string;
  pricePerHourPublic: string;
}

export interface WizardSlotDto {
  startTime: string;
  endTime: string;
  durationMinutes: number;
  availableCourtIds: string[];
}

export interface WizardAvailabilityResponse {
  locationId: string;
  timezone: string;
  bookingDate: string;
  windowId: string;
  durationMinutes: number;
  slotGridMinutes: number;
  courts: WizardCourtSummary[];
  slots: WizardSlotDto[];
}

function timeToMinutes(time: string): number {
  const [h = 0, m = 0] = time.split(":").map((x) => parseInt(x, 10));
  return h * 60 + m;
}

function formatTimeMinutes(total: number): string {
  const h = Math.floor(total / 60);
  const m = total % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

function intervalsOverlap(
  aStart: number,
  aEnd: number,
  bStart: number,
  bEnd: number,
): boolean {
  return aStart < bEnd && bStart < aEnd;
}

function parseAllowedDurations(raw: string): number[] {
  try {
    const v = JSON.parse(raw) as unknown;
    if (!Array.isArray(v)) return [60];
    return v
      .map((x) => (typeof x === "number" ? x : parseInt(String(x), 10)))
      .filter((n) => Number.isFinite(n) && n > 0);
  } catch {
    return [60];
  }
}

@Injectable()
export class CourtWizardAvailabilityService {
  constructor(
    @InjectRepository(Location)
    private readonly locationRepo: Repository<Location>,
    @InjectRepository(LocationBookingWindow)
    private readonly windowRepo: Repository<LocationBookingWindow>,
    @InjectRepository(Court)
    private readonly courtRepo: Repository<Court>,
    @InjectRepository(CourtBooking)
    private readonly courtBookingRepo: Repository<CourtBooking>,
    @InjectRepository(CoachSession)
    private readonly coachSessionRepo: Repository<CoachSession>,
    @InjectRepository(UserLocationMembership)
    private readonly membershipRepo: Repository<UserLocationMembership>,
  ) {}

  private async assertCanAccessLocation(userId: string, location: Location) {
    if (location.visibility !== LocationVisibility.PRIVATE) return;
    const m = await this.membershipRepo.findOne({
      where: {
        userId,
        locationId: location.id,
        status: MembershipStatus.ACTIVE,
      },
    });
    if (!m) {
      throw new ForbiddenException(
        "An active membership is required to view booking windows at this private location",
      );
    }
  }

  async listBookingWindows(
    userId: string,
    locationId: string,
    sport: string,
    courtType: string,
  ): Promise<BookingWindowDto[]> {
    const location = await this.locationRepo.findOne({
      where: { id: locationId },
    });
    if (!location) throw new NotFoundException("Location not found");
    await this.assertCanAccessLocation(userId, location);

    const rows = await this.windowRepo.find({
      where: {
        locationId,
        sport,
        courtType,
        isActive: true,
      },
      order: { sortOrder: "ASC", windowStartTime: "ASC" },
    });

    return rows.map((w) => ({
      id: w.id,
      locationId: w.locationId,
      sport: w.sport,
      courtType: w.courtType,
      windowStartTime: w.windowStartTime,
      windowEndTime: w.windowEndTime,
      allowedDurationMinutes: parseAllowedDurations(w.allowedDurationMinutes),
      slotGridMinutes: w.slotGridMinutes,
      sortOrder: w.sortOrder,
    }));
  }

  async computeWizardAvailability(params: {
    userId: string;
    locationId: string;
    sport: string;
    courtType: string;
    bookingDate: string;
    windowId: string;
    durationMinutes: number;
  }): Promise<WizardAvailabilityResponse> {
    const {
      userId,
      locationId,
      sport,
      courtType,
      bookingDate,
      windowId,
      durationMinutes,
    } = params;

    const location = await this.locationRepo.findOne({
      where: { id: locationId },
    });
    if (!location) throw new NotFoundException("Location not found");
    await this.assertCanAccessLocation(userId, location);

    const window = await this.windowRepo.findOne({
      where: { id: windowId, locationId, isActive: true },
    });
    if (!window) {
      throw new NotFoundException("Booking window not found for this location");
    }
    if (window.sport !== sport || window.courtType !== courtType) {
      throw new BadRequestException(
        "Window does not match selected sport and court type",
      );
    }

    const allowed = parseAllowedDurations(window.allowedDurationMinutes);
    if (!allowed.includes(durationMinutes)) {
      throw new BadRequestException(
        `Duration ${durationMinutes} min is not allowed for this window. Allowed: ${allowed.join(", ")}`,
      );
    }

    const courts = await this.courtRepo.find({
      where: {
        locationId,
        sport,
        type: courtType,
        status: "active",
      },
      order: { name: "ASC" },
    });

    const dateStr = bookingDate.slice(0, 10);
    const todayYmd = ymdTodayInIanaTimeZone(location.timezone);
    if (dateStr < todayYmd) {
      throw new BadRequestException(
        "Cannot load availability for a past date at this venue",
      );
    }

    if (courts.length === 0) {
      return {
        locationId,
        timezone: location.timezone,
        bookingDate: dateStr,
        windowId,
        durationMinutes,
        slotGridMinutes: window.slotGridMinutes,
        courts: [],
        slots: [],
      };
    }
    const courtIds = courts.map((c) => c.id);

    const bookings = await this.courtBookingRepo
      .createQueryBuilder("b")
      .where("b.courtId IN (:...ids)", { ids: courtIds })
      .andWhere("b.bookingDate = :d", { d: dateStr })
      .andWhere("b.bookingStatus IN (:...st)", {
        st: [CourtBookingStatus.PENDING, CourtBookingStatus.CONFIRMED],
      })
      .getMany();

    const sessions = await this.coachSessionRepo
      .createQueryBuilder("s")
      .where("s.courtId IN (:...ids)", { ids: courtIds })
      .andWhere("s.sessionDate = :d", { d: dateStr })
      .andWhere("s.status = :sched", {
        sched: CoachSessionStatus.SCHEDULED,
      })
      .getMany();

    const busyByCourt = new Map<string, { start: number; end: number }[]>();
    for (const id of courtIds) busyByCourt.set(id, []);

    for (const b of bookings) {
      const list = busyByCourt.get(b.courtId);
      if (!list) continue;
      list.push({
        start: timeToMinutes(b.startTime),
        end: timeToMinutes(b.endTime),
      });
    }

    for (const s of sessions) {
      if (!s.courtId) continue;
      const list = busyByCourt.get(s.courtId);
      if (!list) continue;
      const start = timeToMinutes(s.startTime);
      list.push({ start, end: start + s.durationMinutes });
    }

    const wStart = timeToMinutes(window.windowStartTime);
    const wEnd = timeToMinutes(window.windowEndTime);
    const grid = Math.max(5, window.slotGridMinutes);
    const nowMinVenue =
      dateStr === todayYmd
        ? wallClockMinutesNowInTimeZone(location.timezone)
        : null;

    const slots: WizardSlotDto[] = [];
    for (let t = wStart; t + durationMinutes <= wEnd; t += grid) {
      if (nowMinVenue !== null && t < nowMinVenue) {
        continue;
      }
      const startTime = formatTimeMinutes(t);
      const endTime = formatTimeMinutes(t + durationMinutes);
      const availableCourtIds: string[] = [];
      for (const c of courts) {
        const busy = busyByCourt.get(c.id) ?? [];
        let free = true;
        for (const iv of busy) {
          if (intervalsOverlap(t, t + durationMinutes, iv.start, iv.end)) {
            free = false;
            break;
          }
        }
        if (free) availableCourtIds.push(c.id);
      }
      slots.push({
        startTime,
        endTime,
        durationMinutes,
        availableCourtIds,
      });
    }

    return {
      locationId,
      timezone: location.timezone,
      bookingDate: dateStr,
      windowId,
      durationMinutes,
      slotGridMinutes: grid,
      courts: courts.map((c) => ({
        id: c.id,
        name: c.name,
        type: c.type,
        sport: c.sport,
        status: c.status,
        pricePerHourPublic: c.pricePerHourPublic,
      })),
      slots,
    };
  }
}
