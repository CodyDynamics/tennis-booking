import { Injectable, OnModuleInit } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { Role } from "../roles/entities/role.entity";
import { Organization } from "../organizations/entities/organization.entity";
import { Branch } from "../branches/entities/branch.entity";
import { Location } from "../locations/entities/location.entity";
import { Court } from "../courts/entities/court.entity";
import { Sport } from "../sports/entities/sport.entity";
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

const TENNIS_IMAGE =
  "https://images.unsplash.com/photo-1554068865-24cecd4e34b8?w=800";
const PICKLEBALL_IMAGE =
  "https://images.unsplash.com/photo-1622163642998-1ea32a664d18?w=800";

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
  ) {}

  async onModuleInit() {
    await this.seedRoles();
    await this.seedSportsTable();
    await this.seedSportsData();
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
        imageUrl: TENNIS_IMAGE,
      },
      {
        code: "pickleball",
        name: "Pickleball",
        description: "Pickleball courts",
        imageUrl: PICKLEBALL_IMAGE,
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
    // 1. Organization
    let org = await this.orgRepo.findOne({ where: { name: "VigorSports" } });
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
      { name: "Oak Creek Tennis Center", address: "2531 Oak Creek Dr." },
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
            courtsToCreate.push({
              locationId: location.id,
              name: `Court ${i}`,
              sport: "tennis",
              type: "outdoor",
              pricePerHour: "20.00",
              description: "Premium Hard Court",
              imageUrl: TENNIS_IMAGE,
            });
          }
        } else {
          for (let i = 1; i <= 4; i++) {
            courtsToCreate.push({
              locationId: location.id,
              name: `Pickleball Court ${i}`,
              sport: "pickleball",
              type: "indoor",
              pricePerHour: "15.00",
              description: "Indoor Pro Court",
              imageUrl: PICKLEBALL_IMAGE,
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
}
