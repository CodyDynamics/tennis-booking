import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { User } from "../users/entities/user.entity";
import { CoachSession } from "../bookings/entities/coach-session.entity";
import { CoachesModule } from "../coaches/coaches.module";
import { ParentGuardianLink } from "./entities/parent-guardian-link.entity";
import { CoachRosterEntry } from "./entities/coach-roster-entry.entity";
import { PlayerMetricSnapshot } from "./entities/player-metric-snapshot.entity";
import { TrainingPlan } from "./entities/training-plan.entity";
import { TrainingPlanItem } from "./entities/training-plan-item.entity";
import { TrainingPlanCompletion } from "./entities/training-plan-completion.entity";
import { SessionFeedbackNote } from "./entities/session-feedback-note.entity";
import { TrainingVideo } from "./entities/training-video.entity";
import { ParentPaymentRequest } from "./entities/parent-payment-request.entity";
import { Achievement } from "./entities/achievement.entity";
import { UserAchievement } from "./entities/user-achievement.entity";
import { PlatformService } from "./platform.service";
import { PlatformController } from "./platform.controller";
import { PlatformAchievementSeed } from "./platform-achievement-seed.service";

@Module({
  imports: [
    TypeOrmModule.forFeature([
      User,
      CoachSession,
      ParentGuardianLink,
      CoachRosterEntry,
      PlayerMetricSnapshot,
      TrainingPlan,
      TrainingPlanItem,
      TrainingPlanCompletion,
      SessionFeedbackNote,
      TrainingVideo,
      ParentPaymentRequest,
      Achievement,
      UserAchievement,
    ]),
    CoachesModule,
  ],
  controllers: [PlatformController],
  providers: [PlatformService, PlatformAchievementSeed],
})
export class PlatformModule {}
