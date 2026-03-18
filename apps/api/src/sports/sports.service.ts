import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { Sport } from "./entities/sport.entity";

@Injectable()
export class SportsService {
  constructor(
    @InjectRepository(Sport)
    private readonly sportRepo: Repository<Sport>,
  ) {}

  async findAll(): Promise<Sport[]> {
    return this.sportRepo.find({ order: { name: "ASC" } });
  }

  async findByCode(code: string): Promise<Sport | null> {
    return this.sportRepo.findOne({ where: { code } });
  }
}
