import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { User } from "./entities/user.entity";

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private userRepo: Repository<User>,
  ) {}

  async findOne(id: string) {
    return this.userRepo.findOne({
      where: { id },
      relations: ["role"],
    });
  }

  async findByEmail(email: string) {
    return this.userRepo.findOne({
      where: { email },
      relations: ["role"],
    });
  }
}
