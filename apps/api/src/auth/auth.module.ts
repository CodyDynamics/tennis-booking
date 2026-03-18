import { Module } from "@nestjs/common";
import { PassportModule } from "@nestjs/passport";
import { TypeOrmModule } from "@nestjs/typeorm";
import { AuthService } from "./auth.service";
import { AuthController } from "./auth.controller";
import { JwtStrategy } from "./strategies/jwt.strategy";
import { LocalStrategy } from "./strategies/local.strategy";
import { GoogleStrategy } from "./strategies/google.strategy";
import { OtpStoreService } from "./otp-store.service";
import { UsersModule } from "../users/users.module";
import { RolesModule } from "../roles/roles.module";
import { EmailModule } from "../email/email.module";
import { PasswordResetToken } from "./entities/password-reset-token.entity";

const googleStrategyProvider = process.env.GOOGLE_CLIENT_ID
  ? [GoogleStrategy]
  : [];

@Module({
  imports: [
    PassportModule,
    TypeOrmModule.forFeature([PasswordResetToken]),
    UsersModule,
    RolesModule,
    EmailModule,
  ],
  controllers: [AuthController],
  providers: [AuthService, OtpStoreService, JwtStrategy, LocalStrategy, ...googleStrategyProvider],
  exports: [AuthService],
})
export class AuthModule {}
