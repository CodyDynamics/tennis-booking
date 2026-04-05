import { Module } from "@nestjs/common";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { TypeOrmModule } from "@nestjs/typeorm";
import { JwtModule } from "@nestjs/jwt";
import { ScheduleModule } from "@nestjs/schedule";

import configuration from "./config/configuration";
import { AuthModule } from "./auth/auth.module";
import { UsersModule } from "./users/users.module";
import { RsaModule } from "./rsa/rsa.module";
import { HealthModule } from "./health/health.module";
import { DatabaseModule } from "./database/database.module";

import { User } from "./users/entities/user.entity";
import { Role } from "./roles/entities/role.entity";
import { PasswordResetToken } from "./auth/entities/password-reset-token.entity";
import { RefreshToken } from "./auth/entities/refresh-token.entity";
import { Location } from "./locations/entities/location.entity";
import { LocationBookingWindow } from "./locations/entities/location-booking-window.entity";
import { Area } from "./areas/entities/area.entity";
import { Court } from "./courts/entities/court.entity";
import { UserLocationMembership } from "./memberships/entities/user-location-membership.entity";
import { MembershipTransaction } from "./memberships/entities/membership-transaction.entity";
import { Sport } from "./sports/entities/sport.entity";
import { Coach } from "./coaches/entities/coach.entity";
import { CourtBooking } from "./bookings/entities/court-booking.entity";
import { CoachSession } from "./bookings/entities/coach-session.entity";
import { BookingCommand } from "./bookings/entities/booking-command.entity";

import { AreasModule } from "./areas/areas.module";
import { CourtsModule } from "./courts/courts.module";
import { CoachesModule } from "./coaches/coaches.module";
import { BookingsModule } from "./bookings/bookings.module";
import { RolesModule } from "./roles/roles.module";
import { SportsModule } from "./sports/sports.module";
import { RedisModule } from "./redis/redis.module";
import { AdminModule } from "./admin/admin.module";
import { NotificationsModule } from "./notifications/notifications.module";

@Module({
  imports: [
    ScheduleModule.forRoot(),
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: [".env", ".env.local"],
      load: [configuration],
      ignoreEnvFile: false,
    }),

    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (config: ConfigService) => {
        console.log(
          "process.env (before DB connect)",
          JSON.stringify(process.env, null, 2),
        );
        return {
          type: "postgres",
          host: config.get<string>("DB_HOST", "localhost"),
          port: parseInt(config.get<string>("DB_PORT", "5432"), 10),
          username: config.get<string>("DB_USER", "postgres"),
          password: config.get<string>("DB_PASS", "postgres"),
          database: config.get<string>("DB_NAME", "booking_tennis"),
          // ssl: { rejectUnauthorized: false },
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
          ],
          // On Render/production, set DB_SYNC=true so TypeORM creates tables (no migrations yet). Can set DB_SYNC=false after first deploy.
          synchronize:
            config.get<string>("DB_SYNC") === "true" ||
            config.get<string>("NODE_ENV") !== "production",
          logging: config.get<string>("DB_LOGGING", "false") === "true",
        };
      },
      inject: [ConfigService],
    }),

    JwtModule.registerAsync({
      imports: [ConfigModule],
      global: true,
      useFactory: (config: ConfigService) => {
        const jwtSecret =
          process.env.JWT_SECRET ||
          config.get<string>("jwt.secret") ||
          "your-secret-key";
        const expiresIn =
          config.get<string>("jwt.expiresIn") ||
          process.env.JWT_EXPIRES_IN ||
          "15m";
        if (!jwtSecret || jwtSecret.trim() === "") {
          throw new Error("JWT_SECRET must be set in environment variables");
        }
        return {
          secret: jwtSecret,
          signOptions: { expiresIn },
        };
      },
      inject: [ConfigService],
    }),

    RedisModule,
    DatabaseModule,
    AuthModule,
    UsersModule,
    RsaModule,
    HealthModule,
    AreasModule,
    CourtsModule,
    CoachesModule,
    NotificationsModule,
    BookingsModule,
    RolesModule,
    SportsModule,
    AdminModule,
  ],
  controllers: [],
  providers: [],
})
export class AppModule {}
