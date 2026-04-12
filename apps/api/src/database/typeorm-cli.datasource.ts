import "reflect-metadata";
import { DataSource } from "typeorm";
import * as dotenv from "dotenv";
import { User } from "../users/entities/user.entity";
import { Role } from "../roles/entities/role.entity";
import { PasswordResetToken } from "../auth/entities/password-reset-token.entity";
import { RefreshToken } from "../auth/entities/refresh-token.entity";
import { Location } from "../locations/entities/location.entity";
import { LocationBookingWindow } from "../locations/entities/location-booking-window.entity";
import { Area } from "../areas/entities/area.entity";
import { Court } from "../courts/entities/court.entity";
import { UserLocationMembership } from "../memberships/entities/user-location-membership.entity";
import { MembershipTransaction } from "../memberships/entities/membership-transaction.entity";
import { Sport } from "../sports/entities/sport.entity";
import { Coach } from "../coaches/entities/coach.entity";
import { CourtBooking } from "../bookings/entities/court-booking.entity";
import { CoachSession } from "../bookings/entities/coach-session.entity";
import { BookingCommand } from "../bookings/entities/booking-command.entity";
import { ParentGuardianLink } from "../platform/entities/parent-guardian-link.entity";
import { CoachRosterEntry } from "../platform/entities/coach-roster-entry.entity";
import { PlayerMetricSnapshot } from "../platform/entities/player-metric-snapshot.entity";
import { TrainingPlan } from "../platform/entities/training-plan.entity";
import { TrainingPlanItem } from "../platform/entities/training-plan-item.entity";
import { TrainingPlanCompletion } from "../platform/entities/training-plan-completion.entity";
import { SessionFeedbackNote } from "../platform/entities/session-feedback-note.entity";
import { TrainingVideo } from "../platform/entities/training-video.entity";
import { ParentPaymentRequest } from "../platform/entities/parent-payment-request.entity";
import { Achievement } from "../platform/entities/achievement.entity";
import { UserAchievement } from "../platform/entities/user-achievement.entity";

// TypeORM CLI does not load Nest ConfigModule, so load env files manually.
dotenv.config({ path: ".env" });
dotenv.config({ path: ".env.local", override: true });

const port = parseInt(process.env.DB_PORT || "5432", 10);
const useDbSsl = process.env.NODE_ENV === "production";

export default new DataSource({
  type: "postgres",
  host: process.env.DB_HOST || "localhost",
  port: Number.isNaN(port) ? 5432 : port,
  username: process.env.DB_USER || "postgres",
  password: process.env.DB_PASS || "postgres",
  database: process.env.DB_NAME || "booking_tennis",
  ssl: useDbSsl ? { rejectUnauthorized: false } : false,
  entities: [
    User,
    Role,
    PasswordResetToken,
    RefreshToken,
    Location,
    LocationBookingWindow,
    Area,
    Court,
    UserLocationMembership,
    MembershipTransaction,
    Sport,
    Coach,
    CourtBooking,
    CoachSession,
    BookingCommand,
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
  ],
  migrations: ["apps/api/src/database/migrations/*.ts"],
  synchronize: false,
  logging: process.env.DB_LOGGING === "true",
});
