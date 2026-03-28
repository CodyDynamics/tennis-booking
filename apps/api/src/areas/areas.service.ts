import { Injectable, NotFoundException } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { Area } from "./entities/area.entity";
import { CreateAreaDto } from "./dto/create-area.dto";
import { UpdateAreaDto } from "./dto/update-area.dto";
import { UserLocationMembership } from "../memberships/entities/user-location-membership.entity";
import { MembershipStatus } from "../memberships/entities/membership.enums";
import { LocationVisibility } from "../locations/entities/location.enums";
import { User } from "../users/entities/user.entity";

@Injectable()
export class AreasService {
  constructor(
    @InjectRepository(Area)
    private readonly areaRepo: Repository<Area>,
    @InjectRepository(UserLocationMembership)
    private readonly membershipRepo: Repository<UserLocationMembership>,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
  ) {}

  create(dto: CreateAreaDto) {
    return this.areaRepo.save(this.areaRepo.create(dto));
  }

  findAll(locationId?: string) {
    return this.areaRepo.find({
      where: locationId ? { locationId } : {},
      order: { name: "ASC" },
    });
  }

  /**
   * - super_admin: all active areas (every location).
   * - User with membership (eligible status): public + private areas only at those locations.
   * - Everyone else (e.g. new registrants with no membership): none — must be assigned first.
   */
  async findBookableForUser(userId: string): Promise<Area[]> {
    const user = await this.userRepo.findOne({
      where: { id: userId },
      relations: ["role"],
    });
    if (user?.role?.name === "super_admin") {
      return this.areaRepo.find({
        where: { status: "active" },
        order: { name: "ASC" },
      });
    }

    const memberships = await this.membershipRepo.find({ where: { userId } });
    const memberLocationIds = memberships
      .filter((m) =>
        [MembershipStatus.ACTIVE, MembershipStatus.GRACE, MembershipStatus.PENDING_PAYMENT].includes(
          m.status,
        ),
      )
      .map((m) => m.locationId);

    if (memberLocationIds.length === 0) {
      return [];
    }

    const qb = this.areaRepo
      .createQueryBuilder("area")
      .where("area.status = :status", { status: "active" })
      .andWhere("area.locationId IN (:...ids)", { ids: memberLocationIds })
      .andWhere("area.visibility IN (:...vis)", {
        vis: [LocationVisibility.PUBLIC, LocationVisibility.PRIVATE],
      });
    return qb.orderBy("area.name", "ASC").getMany();
  }

  async findOne(id: string) {
    const area = await this.areaRepo.findOne({ where: { id } });
    if (!area) throw new NotFoundException("Area not found");
    return area;
  }

  async update(id: string, dto: UpdateAreaDto) {
    await this.findOne(id);
    await this.areaRepo.update(id, dto);
    return this.findOne(id);
  }

  async remove(id: string) {
    await this.findOne(id);
    await this.areaRepo.delete(id);
    return { deleted: true };
  }
}
