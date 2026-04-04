import { BadRequestException, Injectable } from "@nestjs/common";
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

export interface SportBreakdownDrilldownRowDto {
  userId: string;
  email: string;
  fullName: string | null;
  bookingCount: number;
  phone: string | null;
  homeAddress: string | null;
  /** One representative court name from this user’s bookings in the segment (MIN for stability). */
  primaryCourtName: string | null;
}

export interface SportBreakdownDrilldownPageDto {
  sport: string;
  dimension: "role" | "bookingType" | "accountType";
  filterValue: string;
  total: number;
  page: number;
  pageSize: number;
  items: SportBreakdownDrilldownRowDto[];
}

export interface KpiDrilldownRowDto {
  id: string;
  title: string;
  subtitle?: string;
  meta?: string;
}

export interface KpiDrilldownPageDto {
  metric: string;
  total: number;
  page: number;
  pageSize: number;
  rows: KpiDrilldownRowDto[];
}

export interface DayBookingDrilldownRowDto {
  id: string;
  bookingDate: string;
  startTime: string;
  endTime: string;
  sport: string | null;
  userName: string;
  userEmail: string;
  courtName: string | null;
  totalPrice: string;
}

export interface DayBookingDrilldownPageDto {
  date: string;
  total: number;
  page: number;
  pageSize: number;
  rows: DayBookingDrilldownRowDto[];
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

  private normalizeRoleFilterForSql(displayOrRaw: string): string {
    const t = displayOrRaw.trim().toLowerCase();
    if (t === "no role") return "no_role";
    return displayOrRaw.trim().toLowerCase();
  }

  /**
   * Distinct bookers in the 14-day sport window matching role / bookingType / accountType,
   * with per-user booking counts (paginated).
   */
  async getSportBreakdownDrilldown(
    sportKey: string,
    dimension: string,
    value: string,
    page = 0,
    pageSize = 40,
  ): Promise<SportBreakdownDrilldownPageDto> {
    const dim = dimension.trim().toLowerCase();
    if (!["role", "bookingtype", "accounttype"].includes(dim)) {
      throw new BadRequestException(
        'dimension must be "role", "bookingType", or "accountType"',
      );
    }
    if (!value?.trim()) {
      throw new BadRequestException("value is required");
    }
    const fromStr = dashboardFromDateStr();
    const sport = sportKey.trim().toLowerCase() || "unknown";
    const take = Math.min(100, Math.max(1, pageSize));
    const skip = Math.max(0, page) * take;

    const applyBaseAndDimension = (
      qb: SelectQueryBuilder<CourtBooking>,
    ): SelectQueryBuilder<CourtBooking> => {
      let q = qb
        .where(`b."bookingDate" >= :from`, { from: fromStr })
        .andWhere(`b."bookingStatus" NOT IN (:...st)`, {
          st: [CourtBookingStatus.CANCELLED],
        })
        .andWhere(`COALESCE(b.sport, 'unknown') = :sport`, { sport });
      if (dim === "role") {
        const rv = this.normalizeRoleFilterForSql(value);
        q = q
          .innerJoin("b.user", "u")
          .leftJoin("u.role", "r")
          .andWhere(`LOWER(COALESCE(r.name, 'no_role')) = :rv`, { rv });
      } else if (dim === "bookingtype") {
        q = q.andWhere(`b.bookingType = :bt`, { bt: value.trim() });
      } else {
        q = q
          .innerJoin("b.user", "u")
          .andWhere(`u.accountType = :at`, { at: value.trim() });
      }
      return q;
    };

    const countQb = applyBaseAndDimension(
      this.courtBookingRepo.createQueryBuilder("b"),
    );
    if (dim === "bookingtype") {
      countQb.innerJoin("b.user", "u");
    }
    const totalRow = await countQb
      .select("COUNT(DISTINCT u.id)", "cnt")
      .getRawOne<{ cnt: string }>();
    const total = parseInt(totalRow?.cnt ?? "0", 10) || 0;

    let listQb = applyBaseAndDimension(
      this.courtBookingRepo.createQueryBuilder("b"),
    );
    if (dim === "bookingtype") {
      listQb = listQb.innerJoin("b.user", "u");
    }
    listQb = listQb.leftJoin("b.court", "court");
    const rows = await listQb
      .select("u.id", "userId")
      .addSelect("u.email", "email")
      .addSelect("u.fullName", "fullName")
      .addSelect("u.phone", "phone")
      .addSelect("u.homeAddress", "homeAddress")
      .addSelect("COUNT(b.id)", "bookingCount")
      .addSelect("MIN(court.name)", "primaryCourtName")
      .groupBy("u.id")
      .addGroupBy("u.email")
      .addGroupBy("u.fullName")
      .addGroupBy("u.phone")
      .addGroupBy("u.homeAddress")
      .orderBy("COUNT(b.id)", "DESC")
      .offset(skip)
      .limit(take)
      .getRawMany<{
        userId: string;
        email: string;
        fullName: string | null;
        phone: string | null;
        homeAddress: string | null;
        bookingCount: string;
        primaryCourtName: string | null;
      }>();

    const dimNorm =
      dim === "bookingtype"
        ? ("bookingType" as const)
        : dim === "accounttype"
          ? ("accountType" as const)
          : ("role" as const);

    return {
      sport,
      dimension: dimNorm,
      filterValue: value.trim(),
      total,
      page: Math.max(0, page),
      pageSize: take,
      items: rows.map((r) => ({
        userId: r.userId,
        email: r.email,
        fullName: r.fullName,
        bookingCount: parseInt(r.bookingCount, 10) || 0,
        phone: r.phone ?? null,
        homeAddress: r.homeAddress ?? null,
        primaryCourtName: r.primaryCourtName ?? null,
      })),
    };
  }

  async getKpiDrilldown(
    metric: string,
    page = 0,
    pageSize = 40,
  ): Promise<KpiDrilldownPageDto> {
    const m = metric.trim();
    const take = Math.min(100, Math.max(1, pageSize));
    const skip = Math.max(0, page) * take;

    switch (m) {
      case "usersActive": {
        const [users, total] = await this.userRepo.findAndCount({
          where: { status: "active" },
          select: { id: true, email: true, fullName: true },
          order: { fullName: "ASC", email: "ASC" },
          skip,
          take,
        });
        return {
          metric: m,
          total,
          page: Math.max(0, page),
          pageSize: take,
          rows: users.map((u) => ({
            id: u.id,
            title: u.fullName || u.email,
            subtitle: u.email,
          })),
        };
      }
      case "courts": {
        const qb = this.courtRepo
          .createQueryBuilder("c")
          .leftJoin("c.location", "loc")
          .select("c.id", "id")
          .addSelect("c.name", "name")
          .addSelect("loc.name", "locName")
          .orderBy("c.name", "ASC");
        const total = await qb.clone().getCount();
        const raw = await qb.offset(skip).limit(take).getRawMany<{
          id: string;
          name: string;
          locName: string | null;
        }>();
        return {
          metric: m,
          total,
          page: Math.max(0, page),
          pageSize: take,
          rows: raw.map((r) => ({
            id: r.id,
            title: r.name,
            subtitle: r.locName ?? "—",
          })),
        };
      }
      case "locations": {
        const [locs, total] = await this.locationRepo.findAndCount({
          select: { id: true, name: true, address: true },
          order: { name: "ASC" },
          skip,
          take,
        });
        return {
          metric: m,
          total,
          page: Math.max(0, page),
          pageSize: take,
          rows: locs.map((l) => ({
            id: l.id,
            title: l.name,
            subtitle: l.address ?? undefined,
          })),
        };
      }
      case "courtBookingsOpen": {
        const qb = this.courtBookingRepo
          .createQueryBuilder("b")
          .innerJoin("b.user", "u")
          .leftJoin("b.court", "ct")
          .where(`b.bookingStatus IN (:...st)`, {
            st: [CourtBookingStatus.CONFIRMED, CourtBookingStatus.PENDING],
          })
          .select("b.id", "id")
          .addSelect(`TO_CHAR(b."bookingDate", 'YYYY-MM-DD')`, "bookingDate")
          .addSelect("b.startTime", "startTime")
          .addSelect("u.fullName", "userName")
          .addSelect("u.email", "userEmail")
          .addSelect("ct.name", "courtName")
          .addSelect("b.bookingStatus", "status")
          .orderBy(`b."bookingDate"`, "DESC")
          .addOrderBy("b.startTime", "DESC");
        const total = await qb.clone().getCount();
        const raw = await qb.offset(skip).limit(take).getRawMany<{
          id: string;
          bookingDate: string;
          startTime: string;
          userName: string;
          userEmail: string;
          courtName: string | null;
          status: string;
        }>();
        return {
          metric: m,
          total,
          page: Math.max(0, page),
          pageSize: take,
          rows: raw.map((r) => ({
            id: r.id,
            title: `${r.bookingDate} · ${String(r.startTime).slice(0, 5)}`,
            subtitle: r.userName || r.userEmail,
            meta: `${r.courtName ?? "Court"} · ${r.status}`,
          })),
        };
      }
      case "coachSessionsScheduled": {
        const qb = this.coachSessionRepo
          .createQueryBuilder("s")
          .innerJoin("s.coach", "ch")
          .innerJoin("ch.user", "u")
          .leftJoin("s.court", "ct")
          .where("s.status = :st", { st: CoachSessionStatus.SCHEDULED })
          .select("s.id", "id")
          .addSelect(`TO_CHAR(s."sessionDate", 'YYYY-MM-DD')`, "sessionDate")
          .addSelect("s.startTime", "startTime")
          .addSelect("u.fullName", "coachName")
          .addSelect("ct.name", "courtName")
          .orderBy(`s."sessionDate"`, "DESC")
          .addOrderBy("s.startTime", "DESC");
        const total = await qb.clone().getCount();
        const raw = await qb.offset(skip).limit(take).getRawMany<{
          id: string;
          sessionDate: string;
          startTime: string;
          coachName: string;
          courtName: string | null;
        }>();
        return {
          metric: m,
          total,
          page: Math.max(0, page),
          pageSize: take,
          rows: raw.map((r) => ({
            id: r.id,
            title: `${r.sessionDate} · ${String(r.startTime).slice(0, 5)}`,
            subtitle: r.coachName,
            meta: r.courtName ?? undefined,
          })),
        };
      }
      case "coaches": {
        const qb = this.coachRepo
          .createQueryBuilder("c")
          .innerJoin("c.user", "u")
          .select("c.id", "id")
          .addSelect("u.fullName", "fullName")
          .addSelect("u.email", "email")
          .orderBy("u.fullName", "ASC");
        const total = await qb.clone().getCount();
        const raw = await qb.offset(skip).limit(take).getRawMany<{
          id: string;
          fullName: string;
          email: string;
        }>();
        return {
          metric: m,
          total,
          page: Math.max(0, page),
          pageSize: take,
          rows: raw.map((r) => ({
            id: r.id,
            title: r.fullName || r.email,
            subtitle: r.email,
          })),
        };
      }
      case "revenue14d": {
        const fromStr = dashboardFromDateStr();
        const qb = this.courtBookingRepo
          .createQueryBuilder("b")
          .innerJoin("b.user", "u")
          .leftJoin("b.court", "ct")
          .where(`b."bookingDate" >= :from`, { from: fromStr })
          .andWhere(`b."bookingStatus" NOT IN (:...st)`, {
            st: [CourtBookingStatus.CANCELLED],
          })
          .select("b.id", "id")
          .addSelect(`TO_CHAR(b."bookingDate", 'YYYY-MM-DD')`, "bookingDate")
          .addSelect("b.startTime", "startTime")
          .addSelect("u.fullName", "userName")
          .addSelect("u.email", "userEmail")
          .addSelect("ct.name", "courtName")
          .addSelect("b.totalPrice", "totalPrice")
          .orderBy(`b."bookingDate"`, "DESC")
          .addOrderBy("b.startTime", "DESC");
        const total = await qb.clone().getCount();
        const raw = await qb.offset(skip).limit(take).getRawMany<{
          id: string;
          bookingDate: string;
          startTime: string;
          userName: string;
          userEmail: string;
          courtName: string | null;
          totalPrice: string;
        }>();
        return {
          metric: m,
          total,
          page: Math.max(0, page),
          pageSize: take,
          rows: raw.map((r) => ({
            id: r.id,
            title: `$${parseFloat(r.totalPrice || "0").toFixed(2)}`,
            subtitle: r.userName || r.userEmail,
            meta: `${r.bookingDate} · ${String(r.startTime).slice(0, 5)} · ${r.courtName ?? "Court"}`,
          })),
        };
      }
      default:
        throw new BadRequestException(`Unknown metric: ${metric}`);
    }
  }

  async getDayCourtBookingsDrilldown(
    date: string,
    page = 0,
    pageSize = 40,
  ): Promise<DayBookingDrilldownPageDto> {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date.trim())) {
      throw new BadRequestException("date must be YYYY-MM-DD");
    }
    const d = date.trim();
    const take = Math.min(100, Math.max(1, pageSize));
    const skip = Math.max(0, page) * take;

    const qb = this.courtBookingRepo
      .createQueryBuilder("b")
      .innerJoin("b.user", "u")
      .leftJoin("b.court", "ct")
      .where(`b."bookingDate" = :d`, { d })
      .andWhere(`b."bookingStatus" NOT IN (:...st)`, {
        st: [CourtBookingStatus.CANCELLED],
      })
      .select("b.id", "id")
      .addSelect(`TO_CHAR(b."bookingDate", 'YYYY-MM-DD')`, "bookingDate")
      .addSelect("b.startTime", "startTime")
      .addSelect("b.endTime", "endTime")
      .addSelect("b.sport", "sport")
      .addSelect("u.fullName", "userName")
      .addSelect("u.email", "userEmail")
      .addSelect("ct.name", "courtName")
      .addSelect("b.totalPrice", "totalPrice")
      .orderBy("b.startTime", "ASC");

    const total = await qb.clone().getCount();
    const raw = await qb.offset(skip).limit(take).getRawMany<{
      id: string;
      bookingDate: string;
      startTime: string;
      endTime: string;
      sport: string | null;
      userName: string;
      userEmail: string;
      courtName: string | null;
      totalPrice: string;
    }>();

    return {
      date: d,
      total,
      page: Math.max(0, page),
      pageSize: take,
      rows: raw.map((r) => ({
        id: r.id,
        bookingDate: r.bookingDate,
        startTime: String(r.startTime).slice(0, 8),
        endTime: String(r.endTime).slice(0, 8),
        sport: r.sport,
        userName: r.userName,
        userEmail: r.userEmail,
        courtName: r.courtName,
        totalPrice: r.totalPrice ?? "0",
      })),
    };
  }
}
