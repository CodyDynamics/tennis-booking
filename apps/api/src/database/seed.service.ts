import { Injectable, OnModuleInit } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { Role } from "../roles/entities/role.entity";
import { Organization } from "../organizations/entities/organization.entity";
import { Branch } from "../branches/entities/branch.entity";
import { Location } from "../locations/entities/location.entity";
import { Court } from "../courts/entities/court.entity";

const DEFAULT_ROLES = [
  { name: "admin", description: "System administrator" },
  { name: "player", description: "Casual player who can book courts" },
  { name: "coach", description: "Tennis coach" },
  { name: "student", description: "Student" },
  { name: "parent", description: "Parent" },
];

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
  ) {}

  async onModuleInit() {
    await this.seedRoles();
    await this.seedSportsData();
  }

  private async seedRoles() {
    for (const r of DEFAULT_ROLES) {
      const existing = await this.roleRepo.findOne({ where: { name: r.name } });
      if (!existing) {
        await this.roleRepo.save(this.roleRepo.create(r));
        console.log(`[SeedService] Created role: ${r.name}`);
      }
    }
  }

  private async seedSportsData() {
    // 1. Organization
    let org = await this.orgRepo.findOne({ where: { name: "VigorSports" } });
    if (!org) {
      org = await this.orgRepo.save(
        this.orgRepo.create({
          name: "VigorSports",
          description: "Premium sports facilities management",
        }),
      );
      console.log(`[SeedService] Created organization: ${org.name}`);
    }

    // 2. Branch
    let branch = await this.branchRepo.findOne({ where: { name: "Texas Region" } });
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
      let location = await this.locationRepo.findOne({ where: { name: locData.name } });
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
          // Add Tennis Courts
          for (let i = 1; i <= 4; i++) {
            courtsToCreate.push({
              locationId: location.id,
              name: `Court ${i}`,
              sport: "tennis",
              type: "outdoor",
              pricePerHour: "20.00",
              description: "Premium Hard Court",
            });
          }
        } else {
          // Add Pickleball Courts
          for (let i = 1; i <= 4; i++) {
            courtsToCreate.push({
              locationId: location.id,
              name: `Pickleball Court ${i}`,
              sport: "pickleball",
              type: "indoor",
              pricePerHour: "15.00",
              description: "Indoor Pro Court",
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
