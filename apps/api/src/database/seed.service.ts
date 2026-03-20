import { Injectable, OnModuleInit } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository, In } from "typeorm";
import * as bcrypt from "bcrypt";
import { Role } from "../roles/entities/role.entity";
import { Organization } from "../organizations/entities/organization.entity";
import { Branch } from "../branches/entities/branch.entity";
import { Location } from "../locations/entities/location.entity";
import { Court } from "../courts/entities/court.entity";
import { Sport } from "../sports/entities/sport.entity";
import { User } from "../users/entities/user.entity";
import { Coach } from "../coaches/entities/coach.entity";
import { getAllPermissionCodes } from "../roles/permissions.constants";

const DEFAULT_ROLES = [
  {
    name: "super_admin",
    description:
      "Full system access; only this role has all permissions by default",
    permissions: "",
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
    @InjectRepository(Organization)
    private orgRepo: Repository<Organization>,
    @InjectRepository(Branch)
    private branchRepo: Repository<Branch>,
    @InjectRepository(Location)
    private locationRepo: Repository<Location>,
    @InjectRepository(Court)
    private courtRepo: Repository<Court>,
    @InjectRepository(Sport)
    private sportRepo: Repository<Sport>,
    @InjectRepository(User)
    private userRepo: Repository<User>,
    @InjectRepository(Coach)
    private coachRepo: Repository<Coach>,
  ) {}

  async onModuleInit() {
    console.log("[SeedService] Starting seed...");
    try {
      await this.seedRoles();
      await this.seedSportsTable();
      await this.seedSportsData();
      await this.ensureLocationMapMetadata();
      await this.updateCourtsWithImages();
      await this.seedCoaches();
      await this.assignCoachCourtAffiliations();
      console.log("[SeedService] Seed finished.");
    } catch (err) {
      console.error("[SeedService] Seed failed:", err);
      throw err;
    }
  }

  private async seedRoles() {
    const allPermissions = getAllPermissionCodes();
    for (const r of DEFAULT_ROLES) {
      const existing = await this.roleRepo.findOne({ where: { name: r.name } });
      if (!existing) {
        const permissions =
          r.name === "super_admin"
            ? allPermissions.join(",")
            : ((r as { permissions?: string }).permissions ?? "");
        await this.roleRepo.save(
          this.roleRepo.create({
            name: r.name,
            description: r.description,
            permissions: permissions || null,
          }),
        );
        console.log(`[SeedService] Created role: ${r.name}`);
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
    // 1. Organization (support both CodyReserve and legacy VigorSports)
    let org = await this.orgRepo.findOne({
      where: { name: In(["CodyReserve", "VigorSports"]) },
    });
    if (!org) {
      org = await this.orgRepo.save(
        this.orgRepo.create({
          name: "CodyReserve",
          description: "Premium sports facilities management",
        }),
      );
      console.log(`[SeedService] Created organization: ${org.name}`);
    }

    // 2. Branch
    let branch = await this.branchRepo.findOne({
      where: { name: "Texas Region" },
    });
    if (!branch) {
      branch = await this.branchRepo.save(
        this.branchRepo.create({
          organizationId: org.id,
          name: "Texas Region",
          address: "TX",
        }),
      );
      console.log(`[SeedService] Created branch: ${branch.name}`);
    }

    // 3. Locations
    const locationsData = [
      {
        name: "DEF Tennis Center",
        address: "4714 Baldwin St, Dallas, TX 75210",
      },
      { name: "Downtown Pickleball Club", address: "100 Main St." },
    ];

    for (const locData of locationsData) {
      let location = await this.locationRepo.findOne({
        where: { name: locData.name },
      });
      if (!location) {
        location = await this.locationRepo.save(
          this.locationRepo.create({
            ...locData,
            branchId: branch.id,
          }),
        );
        console.log(`[SeedService] Created location: ${location.name}`);

        // 4. Courts
        const courtsToCreate = [];
        if (location.name.includes("Tennis")) {
          for (let i = 1; i <= 4; i++) {
            const idx = (i - 1) % TENNIS_IMAGES.length;
            courtsToCreate.push({
              locationId: location.id,
              name: `Court ${i}`,
              sport: "tennis",
              type: "outdoor",
              pricePerHour: "20.00",
              description:
                "Premium hard court with professional surface. Ideal for training and matches.",
              imageUrl: TENNIS_IMAGES[idx],
              imageGallery: TENNIS_GALLERIES[idx],
              mapEmbedUrl: MAP_EMBED,
            });
          }
        } else {
          for (let i = 1; i <= 4; i++) {
            const idx = (i - 1) % PICKLEBALL_IMAGES.length;
            courtsToCreate.push({
              locationId: location.id,
              name: `Pickleball Court ${i}`,
              sport: "pickleball",
              type: "indoor",
              pricePerHour: "15.00",
              description:
                "Indoor pro court with climate control. Perfect for year-round play.",
              imageUrl: PICKLEBALL_IMAGES[idx],
              imageGallery: PICKLEBALL_GALLERIES[idx],
              mapEmbedUrl: MAP_EMBED,
            });
          }
        }

        for (const c of courtsToCreate) {
          await this.courtRepo.save(this.courtRepo.create(c));
          console.log(`[SeedService] Created court: ${c.name} (${c.sport})`);
        }
      }
    }
  }

  /** Update all existing courts with image URLs and map embed (varied per court) */
  private async updateCourtsWithImages() {
    const tennisCourts = await this.courtRepo.find({
      where: { sport: "tennis" },
    });
    const pickleballCourts = await this.courtRepo.find({
      where: { sport: "pickleball" },
    });
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
    const org = await this.orgRepo.findOne({
      where: { name: In(["CodyReserve", "VigorSports"]) },
    });
    const branch = await this.branchRepo.findOne({
      where: { name: "Texas Region" },
    });
    const coachRole = await this.roleRepo.findOne({ where: { name: "coach" } });
    if (!org || !branch || !coachRole) {
      console.log(
        "[SeedService] Coaches skip: need CodyReserve org, Texas Region branch, and coach role.",
      );
      return;
    }

    /* eslint-disable prettier/prettier */
    const coachUsers = [
      {
        email: "coach1@codyreserve.com",
        fullName: "Alex Rivera",
        bio: "Certified tennis and pickleball coach. 10+ years experience.",
        hourlyRate: "45.00",
        avatarUrl:
          "https://images.unsplash.com/photo-1560250097-0b93528c311a?w=200&h=200&fit=crop&q=80",
      },
      {
        email: "coach2@codyreserve.com",
        fullName: "Jordan Lee",
        bio: "Former collegiate player. Specializing in technique and match strategy.",
        hourlyRate: "50.00",
        avatarUrl:
          "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=200&h=200&fit=crop&q=80",
      },
      {
        email: "coach3@codyreserve.com",
        fullName: "Morgan Taylor",
        bio: "USPTA certified. Focus on doubles and singles strategy.",
        hourlyRate: "48.00",
        avatarUrl:
          "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=200&h=200&fit=crop&q=80",
      },
      {
        email: "coach4@codyreserve.com",
        fullName: "Casey Kim",
        bio: "Pickleball specialist. Tournament experience and beginner programs.",
        hourlyRate: "42.00",
        avatarUrl:
          "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=200&h=200&fit=crop&q=80",
      },
      {
        email: "coach5@codyreserve.com",
        fullName: "Riley Chen",
        bio: "Tennis and pickleball. Junior development and adult clinics.",
        hourlyRate: "46.00",
        avatarUrl:
          "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=200&h=200&fit=crop&q=80",
      },
      {
        email: "coach6@codyreserve.com",
        fullName: "Sam Davis",
        bio: "Former ATP circuit. Serve and volley specialist.",
        hourlyRate: "55.00",
        avatarUrl:
          "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=200&h=200&fit=crop&q=80",
      },
      {
        email: "coach7@codyreserve.com",
        fullName: "Jamie Wright",
        bio: "Fitness and tennis combined. Movement and conditioning.",
        hourlyRate: "44.00",
        avatarUrl:
          "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=200&h=200&fit=crop&q=80",
      },
      {
        email: "coach8@codyreserve.com",
        fullName: "Drew Martinez",
        bio: "High-performance tennis. Mental game and match play.",
        hourlyRate: "52.00",
        avatarUrl:
          "https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=200&h=200&fit=crop&q=80",
      },
      {
        email: "coach9@codyreserve.com",
        fullName: "Quinn Anderson",
        bio: "Pickleball and paddle sports. Group lessons and leagues.",
        hourlyRate: "40.00",
        avatarUrl:
          "https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=200&h=200&fit=crop&q=80",
      },
      {
        email: "coach10@codyreserve.com",
        fullName: "Skyler Brown",
        bio: "Tennis fundamentals and footwork. All levels welcome.",
        hourlyRate: "43.00",
        avatarUrl:
          "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=200&h=200&fit=crop&q=80",
      },
      {
        email: "coach11@codyreserve.com",
        fullName: "Jordan Smith",
        bio: "Doubles strategy and net play. Tournament preparation.",
        hourlyRate: "49.00",
        avatarUrl:
          "https://images.unsplash.com/photo-1519345182560-3f2917c472ef?w=200&h=200&fit=crop&q=80",
      },
      {
        email: "coach12@codyreserve.com",
        fullName: "Taylor Green",
        bio: "Junior tennis and pickleball. Fun, progressive curriculum.",
        hourlyRate: "41.00",
        avatarUrl:
          "https://images.unsplash.com/photo-1531746020798-e6953c6e8e04?w=200&h=200&fit=crop&q=80",
      },
      {
        email: "coach13@codyreserve.com",
        fullName: "Reese White",
        bio: "Recovery and technique. Injury prevention for players.",
        hourlyRate: "47.00",
        avatarUrl:
          "https://images.unsplash.com/photo-1517841905240-472988babdf9?w=200&h=200&fit=crop&q=80",
      },
      {
        email: "coach14@codyreserve.com",
        fullName: "Cameron Hall",
        bio: "Serve technique and power. Video analysis available.",
        hourlyRate: "51.00",
        avatarUrl:
          "https://images.unsplash.com/photo-1502685104226-ee32379fefbe?w=200&h=200&fit=crop&q=80",
      },
      {
        email: "coach15@codyreserve.com",
        fullName: "Avery Clark",
        bio: "Mixed doubles and social play. Leagues and round robins.",
        hourlyRate: "39.00",
        avatarUrl:
          "https://images.unsplash.com/photo-1524504388940-b1c1722653e1?w=200&h=200&fit=crop&q=80",
      },
      {
        email: "coach16@codyreserve.com",
        fullName: "Parker Lewis",
        bio: "Tennis and pickleball. High school and college prep.",
        hourlyRate: "53.00",
        avatarUrl:
          "https://images.unsplash.com/photo-1507591064344-4c6ce005b128?w=200&h=200&fit=crop&q=80",
      },
      {
        email: "coach17@codyreserve.com",
        fullName: "Blake Young",
        bio: "Beginner to advanced. Patience and clear communication.",
        hourlyRate: "38.00",
        avatarUrl:
          "https://images.unsplash.com/photo-1529626455594-4ff0802cfb7e?w=200&h=200&fit=crop&q=80",
      },
      {
        email: "coach18@codyreserve.com",
        fullName: "Morgan King",
        bio: "Competitive pickleball. Dinking and third-shot drops.",
        hourlyRate: "44.00",
        avatarUrl:
          "https://images.unsplash.com/photo-1539571696357-5a69c3a0062f?w=200&h=200&fit=crop&q=80",
      },
      {
        email: "coach19@codyreserve.com",
        fullName: "Riley Scott",
        bio: "Tennis tactics and match analysis. Film review sessions.",
        hourlyRate: "54.00",
        avatarUrl:
          "https://images.unsplash.com/photo-1528892952291-009c663ce843?w=200&h=200&fit=crop&q=80",
      },
      {
        email: "coach20@codyreserve.com",
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
        email: `coach${n}@codyreserve.com`,
        fullName: `Independent Pro ${n}`,
        bio: "Independent coach (seed). Listed on the public coach directory; not tied to a single court.",
        hourlyRate: `${40 + (i % 12)}.00`,
        avatarUrl: TENNIS_IMAGES[i % TENNIS_IMAGES.length],
      };
    });

    const passwordHash = await bcrypt.hash("Password123!", 10);

    const upsertCoachUser = async (c: {
      email: string;
      fullName: string;
      bio: string;
      hourlyRate: string;
      avatarUrl: string;
      courtId?: string | null;
    }) => {
      let user = await this.userRepo.findOne({
        where: { email: c.email, organizationId: org.id },
      });
      if (!user) {
        user = await this.userRepo.save(
          this.userRepo.create({
            organizationId: org.id,
            branchId: branch.id,
            roleId: coachRole.id,
            email: c.email,
            passwordHash,
            fullName: c.fullName,
            status: "active",
            courtId: c.courtId ?? null,
            visibility: "public",
          }),
        );
        console.log(`[SeedService] Created coach user: ${c.fullName}`);
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
        name: "DEF Tennis Center",
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
        name: "Downtown Pickleball Club",
        address: "100 Main St.",
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
      });
      console.log(`[SeedService] Map metadata updated for: ${c.name}`);
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

    const org = await this.orgRepo.findOne({
      where: { name: In(["CodyReserve", "VigorSports"]) },
    });
    const branch = await this.branchRepo.findOne({
      where: { name: "Texas Region" },
    });
    if (!org || !branch) {
      console.log("[SeedService] Coach assignments skip: org/branch missing.");
      return;
    }

    const allCourts = await this.courtRepo.find({
      order: { locationId: "ASC", name: "ASC" },
    });
    if (!allCourts.length) {
      console.log("[SeedService] Coach assignments skip: no courts.");
      return;
    }

    const legacyEmails = Array.from(
      { length: 20 },
      (_, i) => `coach${i + 1}@codyreserve.com`,
    );
    const freeEmails = Array.from(
      { length: 20 },
      (_, i) => `coach${i + 21}@codyreserve.com`,
    );

    for (let i = 0; i < legacyEmails.length; i++) {
      const user = await this.userRepo.findOne({
        where: { email: legacyEmails[i], organizationId: org.id },
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
        where: { email, organizationId: org.id },
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

    for (const court of allCourts) {
      const target = coachTargetForCourt(court.id);
      let assigned = await this.userRepo.count({
        where: { courtId: court.id },
      });
      while (assigned < target) {
        const email = `autofill-${court.id}-slot${assigned}@codyreserve.com`;
        let user = await this.userRepo.findOne({
          where: { email, organizationId: org.id },
        });
        if (!user) {
          user = await this.userRepo.save(
            this.userRepo.create({
              organizationId: org.id,
              branchId: branch.id,
              roleId: coachRole.id,
              email,
              passwordHash,
              fullName: `Demo staff — ${court.name} #${assigned + 1}`,
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
          console.log(
            `[SeedService] Autofill coach for court "${court.name}" (${assigned + 1}/${target})`,
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
        assigned = await this.userRepo.count({
          where: { courtId: court.id },
        });
      }
    }

    console.log(
      "[SeedService] Coach assignments: legacy coach1–20 → courts (round-robin), coach21–40 → unassigned, each court 10–15 coaches (autofill).",
    );
  }
}
