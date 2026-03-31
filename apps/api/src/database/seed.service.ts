import { Injectable, OnModuleInit } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository, In } from "typeorm";
import * as bcrypt from "bcrypt";
import { Role } from "../roles/entities/role.entity";
import { Location } from "../locations/entities/location.entity";
import { LocationKind } from "../locations/entities/location-kind.enum";
import { Court } from "../courts/entities/court.entity";
import { Sport } from "../sports/entities/sport.entity";
import { User } from "../users/entities/user.entity";
import { Coach } from "../coaches/entities/coach.entity";
import { LocationBookingWindow } from "../locations/entities/location-booking-window.entity";
import { LocationVisibility } from "../locations/entities/location.enums";
import { Area } from "../areas/entities/area.entity";
import { UserLocationMembership } from "../memberships/entities/user-location-membership.entity";
import { MembershipTransaction } from "../memberships/entities/membership-transaction.entity";
import {
  MembershipStatus,
  MembershipTransactionType,
} from "../memberships/entities/membership.enums";
import { CourtBooking } from "../bookings/entities/court-booking.entity";
import { getAllPermissionCodes } from "../roles/permissions.constants";

const DEFAULT_ROLES = [
  {
    name: "super_admin",
    description:
      "Full system access; only this role has all permissions by default",
    permissions: "",
  },
  {
    name: "super_user",
    description:
      "Location operator: users, memberships, courts for assigned location(s) only",
    permissions:
      "dashboard:view,memberships:view,users:view,users:create,users:update,users:delete,courts:view,courts:create,courts:update,courts:delete,bookings:view,bookings:update,areas:view,areas:create,areas:update,areas:delete",
  },
  {
    name: "admin",
    description: "Administrator (permissions assigned by super_admin)",
  },
  { name: "player", description: "Casual player who can book courts" },
  { name: "coach", description: "Tennis / Pickleball coach" },
  { name: "student", description: "Student" },
  { name: "parent", description: "Parent" },
];

// Varied tennis & pickleball images (Unsplash) – different image per court
const TENNIS_IMAGES = [
  "https://images.unsplash.com/photo-1554068865-24cecd4e34b8?w=1200&q=80",
  "https://images.unsplash.com/photo-1622279457486-62dcc4a431d6?w=1200&q=80",
  "https://images.unsplash.com/photo-1595435933710-d7bfb0f5611a?w=1200&q=80",
  "https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?w=1200&q=80",
];
const PICKLEBALL_IMAGES = [
  "https://images.unsplash.com/photo-1622163642998-1ea32a664d18?w=1200&q=80",
  "https://images.unsplash.com/photo-1611916656173-875e4277bea6?w=1200&q=80",
];

const TENNIS_GALLERIES = TENNIS_IMAGES.map((img, i) =>
  JSON.stringify([img, ...TENNIS_IMAGES.filter((_, j) => j !== i).slice(0, 3)]),
);
const PICKLEBALL_GALLERIES = PICKLEBALL_IMAGES.map((img) =>
  JSON.stringify([img, ...PICKLEBALL_IMAGES.filter((u) => u !== img)]),
);

// Sample Google Maps embed (replace with real location URL in production)
const MAP_EMBED =
  "https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3022.184052889387!2d-73.987844684286!3d40.748440979326!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x89c259a9b3117469%3A0xd134e199a405a163!2sEmpire%20State%20Building!5e0!3m2!1sen!2sus!4v1234567890";

@Injectable()
export class SeedService implements OnModuleInit {
  constructor(
    @InjectRepository(Role)
    private roleRepo: Repository<Role>,
    @InjectRepository(Location)
    private locationRepo: Repository<Location>,
    @InjectRepository(Area)
    private areaRepo: Repository<Area>,
    @InjectRepository(Court)
    private courtRepo: Repository<Court>,
    @InjectRepository(Sport)
    private sportRepo: Repository<Sport>,
    @InjectRepository(User)
    private userRepo: Repository<User>,
    @InjectRepository(Coach)
    private coachRepo: Repository<Coach>,
    @InjectRepository(LocationBookingWindow)
    private bookingWindowRepo: Repository<LocationBookingWindow>,
    @InjectRepository(UserLocationMembership)
    private membershipRepo: Repository<UserLocationMembership>,
    @InjectRepository(MembershipTransaction)
    private membershipTxRepo: Repository<MembershipTransaction>,
    @InjectRepository(CourtBooking)
    private courtBookingRepo: Repository<CourtBooking>,
  ) {}

  async onModuleInit() {
    console.log("[SeedService] Starting seed...");
    try {
      await this.seedRoles();
      await this.seedSportsTable();
      // --- Locations, courts, coach users, demo memberships: create manually after DB clear ---
      // await this.seedSportsData();
      // await this.ensureLocationMapMetadata();
      // Manual DB cleanup is handled externally when needed.
      // Skip auto-delete in seed flow to avoid FK/TRUNCATE issues.
      // await this.clearBookingsAndWindows();
      // await this.seedLocationBookingWindows();
      // await this.ensureExpandedCourtsAndPrices();
      // await this.updateCourtsWithImages();
      // await this.seedCoaches();
      // await this.assignCoachCourtAffiliations();
      // await this.seedPrivateClubDemoMember();
      // await this.assignUsersToSpringparkLocations();
      console.log("[SeedService] Seed finished.");
    } catch (err) {
      console.error("[SeedService] Seed failed:", err);
      throw err;
    }
  }

  /**
   * Clear all court bookings and booking windows so we get a clean test state.
   * Inserts simplified test windows after this runs.
   * Only runs in non-production environments.
   */
  private async clearBookingsAndWindows() {
    if (process.env.NODE_ENV === "production") return;
    const deletedBookings = await this.courtBookingRepo.count();
    await this.courtBookingRepo.clear();
    console.log(`[SeedService] Cleared ${deletedBookings} court bookings.`);
    const deletedWindows = await this.bookingWindowRepo.count();
    await this.bookingWindowRepo.clear();
    console.log(`[SeedService] Cleared ${deletedWindows} booking windows.`);
  }

  private async seedRoles() {
    const allPermissions = getAllPermissionCodes();
    for (const r of DEFAULT_ROLES) {
      const permissions =
        r.name === "super_admin"
          ? allPermissions.join(",")
          : ((r as { permissions?: string }).permissions ?? "");
      const existing = await this.roleRepo.findOne({ where: { name: r.name } });
      if (!existing) {
        await this.roleRepo.save(
          this.roleRepo.create({
            name: r.name,
            description: r.description,
            permissions: permissions || null,
          }),
        );
        console.log(`[SeedService] Created role: ${r.name}`);
      } else if (r.name === "super_user" && permissions) {
        const existingStr = String(existing.permissions ?? "").trim();
        const needsSeed =
          !existingStr ||
          !existingStr.includes("areas:view") ||
          !existingStr.includes("dashboard:view") ||
          !existingStr.includes("memberships:view");
        if (needsSeed) {
          await this.roleRepo.update(existing.id, { permissions });
          console.log(`[SeedService] Updated super_user role permissions`);
        }
      }
    }
  }

  private async seedSportsTable() {
    const sportsData = [
      {
        code: "tennis",
        name: "Tennis",
        description: "Tennis courts",
        imageUrl: TENNIS_IMAGES[0],
      },
      {
        code: "pickleball",
        name: "Pickleball",
        description: "Pickleball courts",
        imageUrl: PICKLEBALL_IMAGES[0],
      },
      {
        code: "ball-machine",
        name: "Ball Machine",
        description: "Ball machine training area (outdoor only)",
        imageUrl: TENNIS_IMAGES[1],
      },
    ];
    for (const s of sportsData) {
      const existing = await this.sportRepo.findOne({
        where: { code: s.code },
      });
      if (!existing) {
        await this.sportRepo.save(this.sportRepo.create(s));
        console.log(`[SeedService] Created sport: ${s.name}`);
      }
    }
  }

  private async seedSportsData() {
    let root = await this.locationRepo.findOne({
      where: { name: "Springpark", kind: LocationKind.ROOT },
    });
    if (!root) {
      root = await this.locationRepo.save(
        this.locationRepo.create({
          name: "Springpark",
          address: "Dallas, TX",
          kind: LocationKind.ROOT,
          parentLocationId: null,
          status: "inactive",
          visibility: LocationVisibility.PUBLIC,
          timezone: "America/Chicago",
        }),
      );
      console.log(`[SeedService] Created root location: ${root.name}`);
    }

    const locationChildrenData = [
      {
        name: "Springpark A",
        address: "4714 Baldwin St, Dallas, TX 75210",
      },
      {
        name: "Springpark B",
        address: "100 Main St, Dallas, TX 75202",
      },
    ];

    for (const child of locationChildrenData) {
      let location = await this.locationRepo.findOne({
        where: { name: child.name },
      });
      if (!location) {
        location = await this.locationRepo.save(
          this.locationRepo.create({
            parentLocationId: root.id,
            kind: LocationKind.CHILD,
            name: child.name,
            address: child.address,
            status: "active",
            visibility: LocationVisibility.PUBLIC,
            timezone: "America/Chicago",
          }),
        );
        console.log(`[SeedService] Created location child: ${location.name}`);
      } else {
        await this.locationRepo.update(location.id, {
          parentLocationId: root.id,
          kind: LocationKind.CHILD,
          status: "active",
          visibility: LocationVisibility.PUBLIC,
          timezone: "America/Chicago",
          address: child.address,
        });
      }
    }

    const superAdminRole = await this.roleRepo.findOne({
      where: { name: "super_admin" },
    });
    if (superAdminRole) {
      const superEmail = "superadmin@gmail.com";
      const existing = await this.userRepo.findOne({
        where: { email: superEmail },
      });
      if (!existing) {
        const passwordHash = await bcrypt.hash("SuperAdmin123!", 10);
        await this.userRepo.save(
          this.userRepo.create({
            roleId: superAdminRole.id,
            email: superEmail,
            passwordHash,
            fullName: "System Super Admin",
            firstName: "System",
            lastName: "Admin",
            phone: "+14595550000",
            status: "active",
            visibility: "private",
          }),
        );
        console.log(
          "[SeedService] Created super admin: superadmin@gmail.com / SuperAdmin123!",
        );
      }
    }
  }

  /** Update all existing courts with image URLs and map embed (varied per court) */
  private async updateCourtsWithImages() {
    const tennisCourts = await this.courtRepo
      .createQueryBuilder("c")
      .where(`'tennis' = ANY(c.sports)`)
      .orderBy("c.name", "ASC")
      .getMany();
    const pickleballCourts = await this.courtRepo
      .createQueryBuilder("c")
      .where(`'pickleball' = ANY(c.sports)`)
      .orderBy("c.name", "ASC")
      .getMany();
    for (let i = 0; i < tennisCourts.length; i++) {
      const court = tennisCourts[i];
      const idx = i % TENNIS_IMAGES.length;
      await this.courtRepo.update(court.id, {
        imageUrl: TENNIS_IMAGES[idx],
        imageGallery: TENNIS_GALLERIES[idx],
        mapEmbedUrl: MAP_EMBED,
      });
    }
    for (let i = 0; i < pickleballCourts.length; i++) {
      const court = pickleballCourts[i];
      const idx = i % PICKLEBALL_IMAGES.length;
      await this.courtRepo.update(court.id, {
        imageUrl: PICKLEBALL_IMAGES[idx],
        imageGallery: PICKLEBALL_GALLERIES[idx],
        mapEmbedUrl: MAP_EMBED,
      });
    }
    const total = tennisCourts.length + pickleballCourts.length;
    console.log(
      `[SeedService] Courts update: ${total} courts (tennis: ${tennisCourts.length}, pickleball: ${pickleballCourts.length})`,
    );
  }

  /** Seed coach users and coach records for the branch (shown in "Our Coaches" at each location) */
  private async seedCoaches() {
    const coachRole = await this.roleRepo.findOne({ where: { name: "coach" } });
    if (!coachRole) {
      console.log("[SeedService] Coaches skip: coach role missing.");
      return;
    }

    /* eslint-disable prettier/prettier */
    const coachUsers = [
      {
        email: "coach1@CodyPlay.com",
        fullName: "Alex Rivera",
        bio: "Certified tennis and pickleball coach. 10+ years experience.",
        hourlyRate: "45.00",
        avatarUrl:
          "https://images.unsplash.com/photo-1560250097-0b93528c311a?w=200&h=200&fit=crop&q=80",
      },
      {
        email: "coach2@CodyPlay.com",
        fullName: "Jordan Lee",
        bio: "Former collegiate player. Specializing in technique and match strategy.",
        hourlyRate: "50.00",
        avatarUrl:
          "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=200&h=200&fit=crop&q=80",
      },
      {
        email: "coach3@CodyPlay.com",
        fullName: "Morgan Taylor",
        bio: "USPTA certified. Focus on doubles and singles strategy.",
        hourlyRate: "48.00",
        avatarUrl:
          "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=200&h=200&fit=crop&q=80",
      },
      {
        email: "coach4@CodyPlay.com",
        fullName: "Casey Kim",
        bio: "Pickleball specialist. Tournament experience and beginner programs.",
        hourlyRate: "42.00",
        avatarUrl:
          "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=200&h=200&fit=crop&q=80",
      },
      {
        email: "coach5@CodyPlay.com",
        fullName: "Riley Chen",
        bio: "Tennis and pickleball. Junior development and adult clinics.",
        hourlyRate: "46.00",
        avatarUrl:
          "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=200&h=200&fit=crop&q=80",
      },
      {
        email: "coach6@CodyPlay.com",
        fullName: "Sam Davis",
        bio: "Former ATP circuit. Serve and volley specialist.",
        hourlyRate: "55.00",
        avatarUrl:
          "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=200&h=200&fit=crop&q=80",
      },
      {
        email: "coach7@CodyPlay.com",
        fullName: "Jamie Wright",
        bio: "Fitness and tennis combined. Movement and conditioning.",
        hourlyRate: "44.00",
        avatarUrl:
          "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=200&h=200&fit=crop&q=80",
      },
      {
        email: "coach8@CodyPlay.com",
        fullName: "Drew Martinez",
        bio: "High-performance tennis. Mental game and match play.",
        hourlyRate: "52.00",
        avatarUrl:
          "https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=200&h=200&fit=crop&q=80",
      },
      {
        email: "coach9@CodyPlay.com",
        fullName: "Quinn Anderson",
        bio: "Pickleball and paddle sports. Group lessons and leagues.",
        hourlyRate: "40.00",
        avatarUrl:
          "https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=200&h=200&fit=crop&q=80",
      },
      {
        email: "coach10@CodyPlay.com",
        fullName: "Skyler Brown",
        bio: "Tennis fundamentals and footwork. All levels welcome.",
        hourlyRate: "43.00",
        avatarUrl:
          "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=200&h=200&fit=crop&q=80",
      },
      {
        email: "coach11@CodyPlay.com",
        fullName: "Jordan Smith",
        bio: "Doubles strategy and net play. Tournament preparation.",
        hourlyRate: "49.00",
        avatarUrl:
          "https://images.unsplash.com/photo-1519345182560-3f2917c472ef?w=200&h=200&fit=crop&q=80",
      },
      {
        email: "coach12@CodyPlay.com",
        fullName: "Taylor Green",
        bio: "Junior tennis and pickleball. Fun, progressive curriculum.",
        hourlyRate: "41.00",
        avatarUrl:
          "https://images.unsplash.com/photo-1531746020798-e6953c6e8e04?w=200&h=200&fit=crop&q=80",
      },
      {
        email: "coach13@CodyPlay.com",
        fullName: "Reese White",
        bio: "Recovery and technique. Injury prevention for players.",
        hourlyRate: "47.00",
        avatarUrl:
          "https://images.unsplash.com/photo-1517841905240-472988babdf9?w=200&h=200&fit=crop&q=80",
      },
      {
        email: "coach14@CodyPlay.com",
        fullName: "Cameron Hall",
        bio: "Serve technique and power. Video analysis available.",
        hourlyRate: "51.00",
        avatarUrl:
          "https://images.unsplash.com/photo-1502685104226-ee32379fefbe?w=200&h=200&fit=crop&q=80",
      },
      {
        email: "coach15@CodyPlay.com",
        fullName: "Avery Clark",
        bio: "Mixed doubles and social play. Leagues and round robins.",
        hourlyRate: "39.00",
        avatarUrl:
          "https://images.unsplash.com/photo-1524504388940-b1c1722653e1?w=200&h=200&fit=crop&q=80",
      },
      {
        email: "coach16@CodyPlay.com",
        fullName: "Parker Lewis",
        bio: "Tennis and pickleball. High school and college prep.",
        hourlyRate: "53.00",
        avatarUrl:
          "https://images.unsplash.com/photo-1507591064344-4c6ce005b128?w=200&h=200&fit=crop&q=80",
      },
      {
        email: "coach17@CodyPlay.com",
        fullName: "Blake Young",
        bio: "Beginner to advanced. Patience and clear communication.",
        hourlyRate: "38.00",
        avatarUrl:
          "https://images.unsplash.com/photo-1529626455594-4ff0802cfb7e?w=200&h=200&fit=crop&q=80",
      },
      {
        email: "coach18@CodyPlay.com",
        fullName: "Morgan King",
        bio: "Competitive pickleball. Dinking and third-shot drops.",
        hourlyRate: "44.00",
        avatarUrl:
          "https://images.unsplash.com/photo-1539571696357-5a69c3a0062f?w=200&h=200&fit=crop&q=80",
      },
      {
        email: "coach19@CodyPlay.com",
        fullName: "Riley Scott",
        bio: "Tennis tactics and match analysis. Film review sessions.",
        hourlyRate: "54.00",
        avatarUrl:
          "https://images.unsplash.com/photo-1528892952291-009c663ce843?w=200&h=200&fit=crop&q=80",
      },
      {
        email: "coach20@CodyPlay.com",
        fullName: "Casey Adams",
        bio: "All-around coach. Tennis, pickleball, and fitness.",
        hourlyRate: "46.00",
        avatarUrl:
          "https://images.unsplash.com/photo-1545167622-3a6ac756afa4?w=200&h=200&fit=crop&q=80",
      },
    ];
    /* eslint-enable prettier/prettier */

    /** 20 additional coaches: directory only (no court); password same as legacy. */
    const freeCoachUsers = Array.from({ length: 20 }, (_, i) => {
      const n = 21 + i;
      return {
        email: `coach${n}@CodyPlay.com`,
        fullName: `Independent Pro ${n}`,
        bio: "Independent coach (seed). Listed on the public coach directory; not tied to a single court.",
        hourlyRate: `${40 + (i % 12)}.00`,
        avatarUrl: TENNIS_IMAGES[i % TENNIS_IMAGES.length],
      };
    });

    const passwordHash = await bcrypt.hash("Password123!", 10);

    let coachPhoneSeq = 1;
    const nextCoachPhone = () =>
      `+1555100${String(coachPhoneSeq++).padStart(4, "0")}`;

    const upsertCoachUser = async (c: {
      email: string;
      fullName: string;
      bio: string;
      hourlyRate: string;
      avatarUrl: string;
      courtId?: string | null;
    }) => {
      let user = await this.userRepo.findOne({
        where: { email: c.email },
      });
      if (!user) {
        user = await this.userRepo.save(
          this.userRepo.create({
            roleId: coachRole.id,
            email: c.email,
            passwordHash,
            fullName: c.fullName,
            phone: nextCoachPhone(),
            status: "active",
            courtId: c.courtId ?? null,
            visibility: "public",
          }),
        );
        console.log(`[SeedService] Created coach user: ${c.fullName}`);
      } else if (!user.phone) {
        await this.userRepo.update(user.id, { phone: nextCoachPhone() });
      }

      const existingCoach = await this.coachRepo.findOne({
        where: { userId: user.id },
      });
      if (!existingCoach) {
        await this.coachRepo.save(
          this.coachRepo.create({
            userId: user.id,
            experienceYears: 10,
            bio: c.bio,
            hourlyRate: c.hourlyRate,
          }),
        );
        console.log(`[SeedService] Created coach profile: ${c.fullName}`);
      }

      if (user && !user.avatarUrl) {
        await this.userRepo.update(user.id, { avatarUrl: c.avatarUrl });
      }
    };

    for (const c of coachUsers) {
      await upsertCoachUser(c);
    }
    for (const c of freeCoachUsers) {
      await upsertCoachUser({ ...c, courtId: null });
    }

    console.log(
      `[SeedService] Coaches: ${coachUsers.length} legacy + ${freeCoachUsers.length} directory-only users processed.`,
    );
  }

  /**
   * Demo map centers + 4 fake “court cluster” markers per location (not real venues).
   */
  private async ensureLocationMapMetadata() {
    const configs: Array<{
      name: string;
      address: string;
      latitude: string;
      longitude: string;
      markers: { lat: number; lng: number; label: string }[];
    }> = [
      {
        name: "Springpark A",
        address: "4714 Baldwin St, Dallas, TX 75210",
        latitude: "32.7492000",
        longitude: "-96.7550000",
        markers: [
          {
            lat: 32.7531,
            lng: -96.7582,
            label: "2187 Maple Vale Rd (demo practice pods)",
          },
          {
            lat: 32.7464,
            lng: -96.7511,
            label: "9402 Cedar Row (demo — not a real facility)",
          },
          {
            lat: 32.7518,
            lng: -96.7489,
            label: "5530 Riverbend Ave (demo court cluster)",
          },
          {
            lat: 32.7479,
            lng: -96.7614,
            label: "1100 Summit Trail (demo training area)",
          },
        ],
      },
      {
        name: "Springpark B",
        address: "100 Main St, Dallas, TX 75202",
        latitude: "32.7831000",
        longitude: "-96.8065000",
        markers: [
          {
            lat: 32.7864,
            lng: -96.8099,
            label: "4421 Oak Hollow Ln (demo — fictional)",
          },
          {
            lat: 32.7802,
            lng: -96.8031,
            label: "3099 Elm Park Way (demo pickleball pods)",
          },
          {
            lat: 32.7851,
            lng: -96.8012,
            label: "672 Larkspur Dr (demo)",
          },
          {
            lat: 32.7816,
            lng: -96.8118,
            label: "8800 Briar Patch Ct (demo venue placeholder)",
          },
        ],
      },
    ];

    for (const c of configs) {
      const loc = await this.locationRepo.findOne({ where: { name: c.name } });
      if (!loc) continue;
      await this.locationRepo.update(loc.id, {
        address: c.address,
        latitude: c.latitude,
        longitude: c.longitude,
        mapMarkers: JSON.stringify(c.markers),
        timezone: "America/Chicago",
        visibility: LocationVisibility.PUBLIC,
        membershipInitiationFeeCents: 0,
        membershipMonthlyFeeCents: 0,
        memberCourtDiscountPercent: 0,
      });
      console.log(`[SeedService] Map metadata updated for: ${c.name}`);
    }
  }

  /**
   * Time windows for the booking wizard (sport + indoor/outdoor), aligned with DATABASE_ERD.
   */
  /**
   * Seed a single test booking window for public tennis courts: 08:00–11:00.
   */
  private async seedLocationBookingWindows() {
    const targetLocations = await this.locationRepo.find({
      where: {
        name: In(["Springpark A", "Springpark B"]),
        visibility: LocationVisibility.PUBLIC,
      },
    });
    if (!targetLocations.length) {
      console.log(
        "[SeedService] seedLocationBookingWindows: no Springpark A/B found, skipping.",
      );
      return;
    }

    for (const loc of targetLocations) {
      await this.bookingWindowRepo.delete({
        locationId: loc.id,
        sport: "tennis",
        courtType: "outdoor",
      });
      await this.bookingWindowRepo.save(
        this.bookingWindowRepo.create({
          locationId: loc.id,
          sport: "tennis",
          courtType: "outdoor",
          windowStartTime: "08:00:00",
          windowEndTime: "11:00:00",
          allowedDurationMinutes: "[30,60,90]",
          slotGridMinutes: 30,
          sortOrder: 0,
          isActive: true,
        }),
      );
      console.log(
        `[SeedService] Booking window reset: 08:00-11:00 (tennis/outdoor @ ${loc.name})`,
      );
    }
  }

  /**
   * Add only 3 public tennis courts for easier booking-flow testing.
   */
  private async ensureExpandedCourtsAndPrices() {
    const locations = await this.locationRepo.find({
      where: {
        name: In(["Springpark A", "Springpark B"]),
        visibility: LocationVisibility.PUBLIC,
      },
      order: { name: "ASC" },
    });
    if (!locations.length) {
      console.log(
        "[SeedService] ensureExpandedCourtsAndPrices skip: Springpark A/B missing.",
      );
      return;
    }

    type CourtSeed = {
      name: string;
      sport: string;
      type: "indoor" | "outdoor";
      pricePerHourPublic: string;
      pricePerHourMember: string | null;
      description: string;
    };

    const hashPick = (s: string, mod: number) => {
      let h = 0;
      for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
      return h % mod;
    };

    const pickTennisMedia = (name: string) => {
      const idx = hashPick(name, TENNIS_IMAGES.length);
      return {
        imageUrl: TENNIS_IMAGES[idx],
        imageGallery: TENNIS_GALLERIES[idx],
      };
    };
    const defCourts: CourtSeed[] = [
      {
        name: "Court 1",
        sport: "tennis",
        type: "outdoor",
        pricePerHourPublic: "22.00",
        pricePerHourMember: null,
        description: "Outdoor hard — baseline practice.",
      },
      {
        name: "Court 2",
        sport: "tennis",
        type: "outdoor",
        pricePerHourPublic: "28.00",
        pricePerHourMember: null,
        description: "Outdoor hard — match play.",
      },
      {
        name: "Court 3",
        sport: "tennis",
        type: "outdoor",
        pricePerHourPublic: "35.00",
        pricePerHourMember: null,
        description: "Outdoor premium surface.",
      },
    ];

    const upsert = async (
      locationId: string,
      areaId: string,
      row: CourtSeed,
    ) => {
      const media = pickTennisMedia(row.name);
      const court = await this.courtRepo.findOne({
        where: { locationId, name: row.name },
      });
      if (!court) {
        await this.courtRepo.save(
          this.courtRepo.create({
            locationId,
            areaId,
            name: row.name,
            sports: [row.sport],
            courtTypes: [row.type],
            pricePerHourPublic: row.pricePerHourPublic,
            pricePerHourMember: row.pricePerHourMember,
            description: row.description,
            imageUrl: media.imageUrl,
            imageGallery: media.imageGallery,
            mapEmbedUrl: MAP_EMBED,
            status: "active",
          }),
        );
        console.log(`[SeedService] Created court: ${row.name} @ ${locationId}`);
        return;
      }
      await this.courtRepo.update(court.id, {
        areaId,
        sports: [row.sport],
        courtTypes: [row.type],
        pricePerHourPublic: row.pricePerHourPublic,
        pricePerHourMember: row.pricePerHourMember,
        description: row.description,
      });
    };

    for (const loc of locations) {
      const areaNames = ["Area 1", "Area 2", "Area 3"];
      // Cleanup/normalize area rows (avoid duplicates like Area 1,1,1 etc)
      const allAreasAtLoc = await this.areaRepo.find({
        where: { locationId: loc.id },
        order: { createdAt: "ASC" },
      });
      const keepSet = new Set(areaNames);
      const seenArea = new Set<string>();
      for (const a of allAreasAtLoc) {
        const duplicated = seenArea.has(a.name);
        const shouldKeep = keepSet.has(a.name) && !duplicated;
        if (!shouldKeep) {
          await this.areaRepo.delete(a.id);
          continue;
        }
        seenArea.add(a.name);
      }

      const areas: Area[] = [];
      for (const areaName of areaNames) {
        const visibility =
          areaName === "Area 2"
            ? LocationVisibility.PRIVATE
            : LocationVisibility.PUBLIC;
        let area = await this.areaRepo.findOne({
          where: { locationId: loc.id, name: areaName },
        });
        if (!area) {
          area = await this.areaRepo.save(
            this.areaRepo.create({
              locationId: loc.id,
              name: areaName,
              description: `${areaName} at ${loc.name}`,
              status: "active",
              visibility,
            }),
          );
        } else {
          await this.areaRepo.update(area.id, { visibility, status: "active" });
        }
        areas.push(area);
      }

      for (let i = 0; i < defCourts.length; i += 1) {
        const row = defCourts[i];
        const area = areas[i % areas.length];
        await upsert(loc.id, area.id, row);
      }

      // Cleanup: keep exactly Court 1/2/3 for each location child.
      const keepNames = new Set(defCourts.map((c) => c.name));
      const allAtLocation = await this.courtRepo.find({
        where: { locationId: loc.id },
        order: { createdAt: "ASC" },
      });

      const seen = new Set<string>();
      for (const c of allAtLocation) {
        const isWanted = keepNames.has(c.name);
        const isDuplicateWanted = isWanted && seen.has(c.name);
        if (!isWanted || isDuplicateWanted) {
          const bookingCount = await this.courtBookingRepo.count({
            where: { courtId: c.id },
          });
          if (bookingCount === 0) {
            await this.courtRepo.delete(c.id);
            console.log(
              `[SeedService] Removed extra/duplicate court: ${c.name} (${c.id})`,
            );
          } else {
            await this.courtRepo.update(c.id, { status: "maintenance" });
            console.log(
              `[SeedService] Marked extra/duplicate court as maintenance (has bookings): ${c.name} (${c.id})`,
            );
          }
        } else {
          seen.add(c.name);
        }
      }
    }

    console.log(
      "[SeedService] Courts catalog: Springpark A/B seeded with Area 1/2/3 + Court 1/2/3.",
    );
  }

  /**
   * Split seeded users by Springpark A/B so each user only sees their own location data.
   */
  private async assignUsersToSpringparkLocations() {
    const [springparkA, springparkB] = await Promise.all([
      this.locationRepo.findOne({ where: { name: "Springpark A" } }),
      this.locationRepo.findOne({ where: { name: "Springpark B" } }),
    ]);
    if (!springparkA || !springparkB) return;

    const users = await this.userRepo
      .createQueryBuilder("u")
      .leftJoinAndSelect("u.role", "r")
      .where("r.name NOT IN (:...roles)", { roles: ["super_admin", "admin"] })
      .orderBy("u.createdAt", "ASC")
      .getMany();

    for (let i = 0; i < users.length; i += 1) {
      const user = users[i];
      const targetLocation = i % 2 === 0 ? springparkA : springparkB;
      const existingMemberships = await this.membershipRepo.find({
        where: { userId: user.id },
      });

      for (const m of existingMemberships) {
        if (m.locationId !== targetLocation.id) {
          await this.membershipRepo.update(m.id, {
            status: MembershipStatus.CANCELLED,
            cancelledAt: new Date(),
          });
        }
      }

      let membership = existingMemberships.find(
        (m) => m.locationId === targetLocation.id,
      );
      if (!membership) {
        const periodEnd = new Date();
        periodEnd.setMonth(periodEnd.getMonth() + 1);
        membership = await this.membershipRepo.save(
          this.membershipRepo.create({
            userId: user.id,
            locationId: targetLocation.id,
            status: MembershipStatus.ACTIVE,
            initiationPaidAt: new Date(),
            currentPeriodStart: new Date(),
            currentPeriodEnd: periodEnd,
            lastMonthlyPaidAt: new Date(),
          }),
        );
      } else if (membership.status !== MembershipStatus.ACTIVE) {
        await this.membershipRepo.update(membership.id, {
          status: MembershipStatus.ACTIVE,
        });
      }
    }

    console.log(
      `[SeedService] Users split by location memberships: ${springparkA.name} / ${springparkB.name}`,
    );
  }

  /**
   * Private locations require active membership to book courts — seed a demo account.
   */
  private async seedPrivateClubDemoMember() {
    const playerRole = await this.roleRepo.findOne({
      where: { name: "player" },
    });
    const loc = await this.locationRepo.findOne({
      where: { name: "Springpark B" },
    });
    if (!playerRole || !loc) return;

    const passwordHash = await bcrypt.hash("Password123!", 10);
    const demoMembers: Array<{
      email: string;
      fullName: string;
      phone: string;
    }> = [
      {
        email: "private-club-demo@CodyPlay.com",
        fullName: "Private Club Demo Member",
        phone: "+15555550999",
      },
      {
        email: "pickleball-member2@CodyPlay.com",
        fullName: "Springpark B Member Two",
        phone: "+15555550888",
      },
    ];

    for (const m of demoMembers) {
      let user = await this.userRepo.findOne({
        where: { email: m.email },
      });
      if (!user) {
        user = await this.userRepo.save(
          this.userRepo.create({
            roleId: playerRole.id,
            email: m.email,
            passwordHash,
            fullName: m.fullName,
            phone: m.phone,
            status: "active",
            visibility: "public",
          }),
        );
        console.log(
          `[SeedService] Demo private-club user: ${m.email} / Password123!`,
        );
      }

      let membership = await this.membershipRepo.findOne({
        where: { userId: user.id, locationId: loc.id },
      });
      if (!membership) {
        const periodEnd = new Date();
        periodEnd.setFullYear(periodEnd.getFullYear() + 1);
        membership = await this.membershipRepo.save(
          this.membershipRepo.create({
            userId: user.id,
            locationId: loc.id,
            status: MembershipStatus.ACTIVE,
            initiationPaidAt: new Date(),
            currentPeriodStart: new Date(),
            currentPeriodEnd: periodEnd,
            lastMonthlyPaidAt: new Date(),
          }),
        );
        const fee = loc.membershipInitiationFeeCents || 0;
        if (fee > 0) {
          await this.membershipTxRepo.save(
            this.membershipTxRepo.create({
              userLocationMembershipId: membership.id,
              type: MembershipTransactionType.INITIATION,
              amountCents: fee,
              currency: "USD",
              periodLabel: "seed-init",
              externalPaymentId: "seed",
              metadata: { source: "SeedService", userEmail: m.email },
            }),
          );
        }
        console.log(
          `[SeedService] Active membership for ${m.email} at ${loc.name}`,
        );
      }
    }
  }

  /**
   * 1) coach1–coach20: each gets a courtId (round-robin all courts).
   * 2) coach21–coach40: courtId null (public directory).
   * 3) Every court: at least 12 coaches (10–15 range target = 12); add autofill users if needed.
   */
  private async assignCoachCourtAffiliations() {
    const coachRole = await this.roleRepo.findOne({ where: { name: "coach" } });
    if (!coachRole) return;

    const allCourts = await this.courtRepo.find({
      order: { locationId: "ASC", name: "ASC" },
    });
    if (!allCourts.length) {
      console.log("[SeedService] Coach assignments skip: no courts.");
      return;
    }

    const legacyEmails = Array.from(
      { length: 20 },
      (_, i) => `coach${i + 1}@CodyPlay.com`,
    );
    const freeEmails = Array.from(
      { length: 20 },
      (_, i) => `coach${i + 21}@CodyPlay.com`,
    );

    for (let i = 0; i < legacyEmails.length; i++) {
      const user = await this.userRepo.findOne({
        where: { email: legacyEmails[i] },
      });
      if (!user) continue;
      const court = allCourts[i % allCourts.length];
      await this.userRepo.update(user.id, {
        courtId: court.id,
        visibility: "public",
      });
    }

    for (const email of freeEmails) {
      const user = await this.userRepo.findOne({
        where: { email },
      });
      if (!user) continue;
      await this.userRepo.update(user.id, {
        courtId: null,
        visibility: "public",
      });
    }

    /** Stable per court between 10 and 15 inclusive. */
    const coachTargetForCourt = (courtId: string) => {
      const hex = courtId.replace(/-/g, "").slice(0, 8);
      const n = parseInt(hex, 16) || 0;
      return 10 + (n % 6);
    };

    const passwordHash = await bcrypt.hash("Password123!", 10);
    let autofillPhoneSeq = 20000;

    console.log(
      `[SeedService] Coach assignments: ${allCourts.length} courts × ~10–15 coaches each — this can take 1–3 minutes; progress per court below.`,
    );

    let courtIdx = 0;
    for (const court of allCourts) {
      courtIdx += 1;
      const target = coachTargetForCourt(court.id);
      /** Monotonic slot index — must not reuse `assigned` in email or we can infinite-loop when user already exists on this court. */
      let nextSlot = 0;
      const maxAttempts = target + 500;

      for (let attempt = 0; attempt < maxAttempts; attempt++) {
        const assigned = await this.userRepo.count({
          where: { courtId: court.id },
        });
        if (assigned >= target) break;

        const email = `autofill-${court.id}-slot${nextSlot}@CodyPlay.com`;
        nextSlot += 1;

        let user = await this.userRepo.findOne({
          where: { email },
        });
        if (!user) {
          user = await this.userRepo.save(
            this.userRepo.create({
              roleId: coachRole.id,
              email,
              passwordHash,
              fullName: `Demo staff — ${court.name} #${assigned + 1}`,
              phone: `+1555${String(autofillPhoneSeq++).padStart(7, "0")}`,
              status: "active",
              courtId: court.id,
              visibility: "public",
            }),
          );
          await this.coachRepo.save(
            this.coachRepo.create({
              userId: user.id,
              experienceYears: 5,
              bio: `Seed coach tied to "${court.name}" only (demo data).`,
              hourlyRate: "42.00",
            }),
          );
        } else {
          await this.userRepo.update(user.id, {
            courtId: court.id,
            visibility: "public",
          });
          const existingProfile = await this.coachRepo.findOne({
            where: { userId: user.id },
          });
          if (!existingProfile) {
            await this.coachRepo.save(
              this.coachRepo.create({
                userId: user.id,
                experienceYears: 5,
                bio: `Seed coach tied to "${court.name}" only (demo data).`,
                hourlyRate: "42.00",
              }),
            );
          }
        }
      }

      const finalCount = await this.userRepo.count({
        where: { courtId: court.id },
      });
      console.log(
        `[SeedService] Court ${courtIdx}/${allCourts.length} "${court.name}": ${finalCount}/${target} coaches`,
      );
    }

    console.log(
      "[SeedService] Coach assignments: legacy coach1–20 → courts (round-robin), coach21–40 → unassigned, each court 10–15 coaches (autofill).",
    );
  }
}
