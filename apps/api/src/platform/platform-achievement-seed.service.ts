import { Injectable, Logger, OnModuleInit } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { Achievement } from "./entities/achievement.entity";

@Injectable()
export class PlatformAchievementSeed implements OnModuleInit {
  private readonly logger = new Logger(PlatformAchievementSeed.name);

  constructor(
    @InjectRepository(Achievement)
    private readonly achievementRepo: Repository<Achievement>,
  ) {}

  async onModuleInit(): Promise<void> {
    const seeds = [
      {
        code: "first_drill",
        title: "First drill",
        description: "Completed a training plan item.",
      },
      {
        code: "five_sessions",
        title: "Regular player",
        description: "Completed five coach sessions.",
      },
    ];
    for (const s of seeds) {
      const exists = await this.achievementRepo.exist({ where: { code: s.code } });
      if (!exists) {
        await this.achievementRepo.save(this.achievementRepo.create(s));
        this.logger.log(`Seeded achievement: ${s.code}`);
      }
    }
  }
}
