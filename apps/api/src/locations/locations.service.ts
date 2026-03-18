import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Location } from './entities/location.entity';
import { CreateLocationDto } from './dto/create-location.dto';
import { UpdateLocationDto } from './dto/update-location.dto';

@Injectable()
export class LocationsService {
  constructor(
    @InjectRepository(Location)
    private locationRepo: Repository<Location>,
  ) {}

  async create(dto: CreateLocationDto) {
    return this.locationRepo.save(this.locationRepo.create(dto));
  }

  async findAll(branchId?: string) {
    const qb = this.locationRepo.createQueryBuilder('location');
    if (branchId) {
      qb.andWhere('location.branchId = :branchId', { branchId });
    }
    return qb.getMany();
  }

  async findOne(id: string) {
    const location = await this.locationRepo.findOne({ where: { id } });
    if (!location) throw new NotFoundException('Location not found');
    return location;
  }

  async update(id: string, dto: UpdateLocationDto) {
    await this.findOne(id);
    await this.locationRepo.update(id, dto);
    return this.findOne(id);
  }

  async remove(id: string) {
    await this.findOne(id);
    await this.locationRepo.delete(id);
    return { deleted: true };
  }
}
