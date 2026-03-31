import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { In, Repository, SelectQueryBuilder } from "typeorm";
import { User } from "../users/entities/user.entity";
import { Court } from "../courts/entities/court.entity";
import { Location } from "../locations/entities/location.entity";
import {
  CourtBooking,
  CourtBookingStatus,
} from "../bookings/entities/court-booking.entity";
import {
  CoachSession,
  CoachSessionStatus,
} from "../bookings/entities/coach-session.entity";
import { Coach } from "../coaches/entities/coach.entity";

/** Same rolling window as daily booking/revenue charts (inclusive). */
function dashboardFromDateStr(): string {
  const fromDay = new Date();
  fromDay.setUTCDate(fromDay.getUTCDate() - 13);
  return fromDay.toISOString().slice(0, 10);
}

export interface SportBookingBreakdownDto {
  /** Normalized key matching `bookingsBySport[].sport` (`unknown` = null/empty sport on rows). */
  sport: string;
  windowDays: 14;
  totalBookings: number;
  byRole: { role: string; count: number }[];
  byBookingType: { bookingType: string; count: number }[];
  byAccountType: { accountType: string; count: number }[];
}

export interface DashboardMetricsDto {
  totals: {
    usersActive: number;
    courts: number;
    locations: number;
    courtBookingsOpen: number;
    coachSessionsScheduled: number;
    coaches: number;
    /** Sum of `court_bookings.totalPrice` over the same 14-day window as daily charts */
    revenue14d: number;
  };
  /** Last 14 days, non-cancelled court bookings, grouped by calendar day */
  dailyCourtBookings: { date: string; count: number }[];
  /** Non-cancelled court bookings grouped by sport */
  bookingsBySport: { sport: string; count: number }[];
  /** Revenue (totalPrice sum) per day, same window */
  dailyRevenue: { date: string; revenue: number }[];
}

@Injectable()
export class AdminService {
  constructor(
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    @InjectRepository(Court)
    private readonly courtRepo: Repository<Court>,
    @InjectRepository(Location)
    private readonly locationRepo: Repository<Location>,
    @InjectRepository(CourtBooking)
    private readonly courtBookingRepo: Repository<CourtBooking>,
    @InjectRepository(CoachSession)
    private readonly coachSessionRepo: Repository<CoachSession>,
    @InjectRepository(Coach)
    private readonly coachRepo: Repository<Coach>,
  ) {}

  async getDashboardMetrics(): Promise<DashboardMetricsDto> {
    const fromStr = dashboardFromDateStr();

    const [
      usersActive,
      courts,
      locations,
      courtBookingsOpen,
      coachSessionsScheduled,
      coaches,
      dailyRaw,
      sportRaw,
      revenueRaw,
    ] = await Promise.all([
      this.userRepo.count({ where: { status: "active" } }),
      this.courtRepo.count(),
      this.locationRepo.count(),
      this.courtBookingRepo.count({
        where: {
          bookingStatus: In([
            CourtBookingStatus.CONFIRMED,
            CourtBookingStatus.PENDING,
          ]),
        },
      }),
      this.coachSessionRepo.count({
        where: { status: CoachSessionStatus.SCHEDULED },
      }),
      this.coachRepo.count(),
      this.courtBookingRepo
        .createQueryBuilder("b")
        .select(`TO_CHAR(b."bookingDate", 'YYYY-MM-DD')`, "date")
        .addSelect("COUNT(*)", "count")
        .where(`b."bookingDate" >= :from`, { from: fromStr })
        .andWhere(`b."bookingStatus" NOT IN (:...st)`, {
          st: [CourtBookingStatus.CANCELLED],
        })
        .groupBy(`b."bookingDate"`)
        .orderBy(`b."bookingDate"`, "ASC")
        .getRawMany<{ date: string; count: string }>(),
      this.courtBookingRepo
        .createQueryBuilder("b")
        .select(`COALESCE(b.sport, 'unknown')`, "sport")
        .addSelect("COUNT(*)", "count")
        .where(`b."bookingDate" >= :from`, { from: fromStr })
        .andWhere(`b."bookingStatus" NOT IN (:...st)`, {
          st: [CourtBookingStatus.CANCELLED],
        })
        .groupBy(`COALESCE(b.sport, 'unknown')`)
        .getRawMany<{ sport: string; count: string }>(),
      this.courtBookingRepo
        .createQueryBuilder("b")
        .select(`TO_CHAR(b."bookingDate", 'YYYY-MM-DD')`, "date")
        .addSelect(`COALESCE(SUM(CAST(b."totalPrice" AS DECIMAL)), 0)`, "revenue")
        .where(`b."bookingDate" >= :from`, { from: fromStr })
        .andWhere(`b."bookingStatus" NOT IN (:...st)`, {
          st: [CourtBookingStatus.CANCELLED],
        })
        .groupBy(`b."bookingDate"`)
        .orderBy(`b."bookingDate"`, "ASC")
        .getRawMany<{ date: string; revenue: string }>(),
    ]);

    const dailyCourtBookings = dailyRaw.map((r) => ({
      date: r.date,
      count: parseInt(r.count, 10) || 0,
    }));

    const bookingsBySport = sportRaw
      .map((r) => ({
        sport: r.sport || "unknown",
        count: parseInt(r.count, 10) || 0,
      }))
      .sort((a, b) => b.count - a.count);

    const dailyRevenue = revenueRaw.map((r) => ({
      date: r.date,
      revenue: parseFloat(r.revenue) || 0,
    }));
    const revenue14d = dailyRevenue.reduce((s, d) => s + d.revenue, 0);

    return {
      totals: {
        usersActive,
        courts,
        locations,
        courtBookingsOpen,
        coachSessionsScheduled,
        coaches,
        revenue14d: Math.round(revenue14d * 100) / 100,
      },
      dailyCourtBookings,
      bookingsBySport,
      dailyRevenue,
    };
  }

  /**
   * Drill-down for the “By sport” chart: bookings in the same 14-day window, grouped by
   * booker role name, `court_bookings.bookingType`, and `users.accountType`.
   */
  async getSportBookingBreakdown(sportKey: string): Promise<SportBookingBreakdownDto> {
    const fromStr = dashboardFromDateStr();
    const sport = sportKey.trim().toLowerCase() || "unknown";

    const baseWhere = (qb: SelectQueryBuilder<CourtBooking>) =>
      qb
        .where(`b."bookingDate" >= :from`, { from: fromStr })
        .andWhere(`b."bookingStatus" NOT IN (:...st)`, {
          st: [CourtBookingStatus.CANCELLED],
        })
        .andWhere(`COALESCE(b.sport, 'unknown') = :sport`, { sport });

    const totalRow = await baseWhere(
      this.courtBookingRepo.createQueryBuilder("b"),
    )
      .select("COUNT(*)", "cnt")
      .getRawOne<{ cnt: string }>();
    const totalBookings = parseInt(totalRow?.cnt ?? "0", 10) || 0;

    const [byRoleRaw, byTypeRaw, byAcctRaw] = await Promise.all([
      baseWhere(this.courtBookingRepo.createQueryBuilder("b"))
        .innerJoin("b.user", "u")
        .leftJoin("u.role", "r")
        .select(`COALESCE(r.name, 'no_role')`, "role")
        .addSelect("COUNT(*)", "cnt")
        .groupBy(`COALESCE(r.name, 'no_role')`)
        .orderBy("cnt", "DESC")
        .getRawMany<{ role: string; cnt: string }>(),
      baseWhere(this.courtBookingRepo.createQueryBuilder("b"))
        .select("b.bookingType", "bookingType")
        .addSelect("COUNT(*)", "cnt")
        .groupBy("b.bookingType")
        .orderBy("cnt", "DESC")
        .getRawMany<{ bookingType: string; cnt: string }>(),
      baseWhere(this.courtBookingRepo.createQueryBuilder("b"))
        .innerJoin("b.user", "u")
        .select("u.accountType", "accountType")
        .addSelect("COUNT(*)", "cnt")
        .groupBy("u.accountType")
        .orderBy("cnt", "DESC")
        .getRawMany<{ accountType: string; cnt: string }>(),
    ]);

    return {
      sport,
      windowDays: 14,
      totalBookings,
      byRole: byRoleRaw.map((r) => ({
        role: r.role === "no_role" ? "No role" : r.role,
        count: parseInt(r.cnt, 10) || 0,
      })),
      byBookingType: byTypeRaw.map((r) => ({
        bookingType: r.bookingType ?? "unknown",
        count: parseInt(r.cnt, 10) || 0,
      })),
      byAccountType: byAcctRaw.map((r) => ({
        accountType: r.accountType ?? "unknown",
        count: parseInt(r.cnt, 10) || 0,
      })),
    };
  }
}
