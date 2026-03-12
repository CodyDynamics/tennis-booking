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

import { User } from "./auth/entities/user.entity";
import { Role } from "./auth/entities/role.entity";
import { PasswordResetToken } from "./auth/entities/password-reset-token.entity";

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
        entities: [User, Role, PasswordResetToken],
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
  ],
  controllers: [],
  providers: [],
})
export class AppModule {}
