import { Injectable, NotFoundException } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { In, Repository } from "typeorm";
import { Area } from "./entities/area.entity";
import { CreateAreaDto } from "./dto/create-area.dto";
import { UpdateAreaDto } from "./dto/update-area.dto";
import { LocationVisibility } from "../locations/entities/location.enums";
import { User } from "../users/entities/user.entity";
import { LocationsService } from "../locations/locations.service";

@Injectable()
export class AreasService {
  constructor(
    @InjectRepository(Area)
    private readonly areaRepo: Repository<Area>,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    private readonly locationsService: LocationsService,
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
   * - User with venue membership (same rules as bookable locations): areas at those child venues.
   * - No membership: none.
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

    const locationIds =
      await this.locationsService.getBookableLocationIdsForUser(userId);
    if (locationIds.length === 0) {
      return [];
    }

    return this.areaRepo.find({
      where: {
        status: "active",
        locationId: In(locationIds),
        visibility: In([
          LocationVisibility.PUBLIC,
          LocationVisibility.PRIVATE,
        ]),
      },
      order: { name: "ASC" },
    });
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
