import { Module } from "@nestjs/common";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { TypeOrmModule } from "@nestjs/typeorm";
import { JwtModule } from "@nestjs/jwt";

import configuration from "./config/configuration";
import { AuthModule } from "./auth/auth.module";
import { UsersModule } from "./users/users.module";
import { RsaModule } from "./rsa/rsa.module";
import { HealthModule } from "./health/health.module";
import { DatabaseModule } from "./database/database.module";

import { User } from "./users/entities/user.entity";
import { Role } from "./roles/entities/role.entity";
import { PasswordResetToken } from "./auth/entities/password-reset-token.entity";
import { Branch } from "./branches/entities/branch.entity";
import { Organization } from "./organizations/entities/organization.entity";
import { Location } from "./locations/entities/location.entity";
import { Court } from "./courts/entities/court.entity";
import { Coach } from "./coaches/entities/coach.entity";
import { CourtBooking } from "./bookings/entities/court-booking.entity";
import { CoachSession } from "./bookings/entities/coach-session.entity";

import { BranchesModule } from "./branches/branches.module";
import { CourtsModule } from "./courts/courts.module";
import { CoachesModule } from "./coaches/coaches.module";
import { BookingsModule } from "./bookings/bookings.module";
import { RolesModule } from "./roles/roles.module";
import { OrganizationsModule } from "./organizations/organizations.module";

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: [".env", ".env.local"],
      load: [configuration],
      ignoreEnvFile: false,
    }),

    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (config: ConfigService) => ({
        type: "postgres",
        host: config.get<string>("DB_HOST", "localhost"),
        port: parseInt(config.get<string>("DB_PORT", "5432"), 10),
        username: config.get<string>("DB_USER", "postgres"),
        password: config.get<string>("DB_PASS", "postgres"),
        database: config.get<string>("DB_NAME", "booking_tennis"),
        entities: [
          User,
          Role,
          PasswordResetToken,
          Branch,
          Organization,
          Location,
          Court,
          Coach,
          CourtBooking,
          CoachSession,
        ],
        synchronize: config.get<string>("NODE_ENV") !== "production",
        logging: config.get<string>("DB_LOGGING", "false") === "true",
      }),
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
          "1h";
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

    DatabaseModule,
    AuthModule,
    UsersModule,
    RsaModule,
    HealthModule,
    BranchesModule,
    CourtsModule,
    CoachesModule,
    BookingsModule,
    RolesModule,
    OrganizationsModule,
  ],
  controllers: [],
  providers: [],
})
export class AppModule {}
