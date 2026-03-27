import {
  Injectable,
  UnauthorizedException,
  BadRequestException,
  ServiceUnavailableException,
  Logger,
} from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { ConfigService } from "@nestjs/config";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import * as bcrypt from "bcrypt";
import * as crypto from "crypto";

import { JwtPayload } from "@app/common";
import { User } from "../users/entities/user.entity";
import { Role } from "../roles/entities/role.entity";
import { PasswordResetToken } from "./entities/password-reset-token.entity";
import { RefreshToken } from "./entities/refresh-token.entity";
import { RedisService } from "../redis/redis.service";
import {
  RegisterDto,
  LoginDto,
  ForgotPasswordDto,
  ResetPasswordDto,
} from "./dto";
import { EmailService } from "../email/email.service";
import { OtpStoreService } from "./otp-store.service";

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    @InjectRepository(User)
    private userRepo: Repository<User>,
    @InjectRepository(Role)
    private roleRepo: Repository<Role>,
    @InjectRepository(PasswordResetToken)
    private resetTokenRepo: Repository<PasswordResetToken>,
    @InjectRepository(RefreshToken)
    private refreshTokenRepo: Repository<RefreshToken>,
    private jwtService: JwtService,
    private configService: ConfigService,
    private emailService: EmailService,
    private otpStore: OtpStoreService,
    private redisService: RedisService,
  ) {}

  async register(registerDto: RegisterDto) {
    const {
      email,
      password,
      fullName,
      firstName,
      lastName,
      phone,
      homeAddress,
      organizationId,
      branchId,
    } = registerDto;

    const byEmail = await this.userRepo.find({ where: { email } });
    const existingUser = byEmail.find(
      (u) => (organizationId || null) === (u.organizationId || null),
    );
    if (existingUser) {
      throw new BadRequestException("User with this email already exists");
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const resolvedFirstName = firstName?.trim() || fullName.trim().split(/\s+/)[0] || null;
    const resolvedLastName =
      lastName?.trim() ||
      (fullName.trim().split(/\s+/).slice(1).join(" ").trim() || null);

    const user = await this.userRepo.save(
      this.userRepo.create({
        email,
        passwordHash,
        fullName,
        firstName: resolvedFirstName,
        lastName: resolvedLastName,
        phone,
        homeAddress: homeAddress ?? null,
        organizationId,
        branchId,
        roleId: null,
        courtId: null,
        visibility: "public",
      }),
    );
    const userWithRole = await this.userRepo.findOne({
      where: { id: user.id },
      relations: ["role"],
    });
    if (!userWithRole) throw new BadRequestException("User not created");

    const tokens = await this.generateTokens(
      userWithRole.id,
      userWithRole.email,
      userWithRole.organizationId ?? undefined,
      userWithRole.roleId ?? undefined,
      { rememberMe: false },
    );

    return {
      user: {
        id: userWithRole.id,
        email: userWithRole.email,
        fullName: userWithRole.fullName,
        role: userWithRole.role?.name,
        mustChangePasswordOnFirstLogin:
          userWithRole.mustChangePasswordOnFirstLogin,
      },
      ...tokens,
    };
  }

  async validateUser(email: string, password: string): Promise<any> {
    const user = await this.userRepo.findOne({
      where: { email },
      relations: ["role"],
    });
    if (!user || !user.passwordHash) return null;

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) return null;

    if (user.status !== "active") {
      throw new UnauthorizedException("Account is inactive");
    }

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { passwordHash: _, ...result } = user;
    return result;
  }

  async login(loginDto: LoginDto) {
    const user = await this.validateUser(loginDto.email, loginDto.password);
    if (!user) {
      throw new UnauthorizedException("Invalid credentials");
    }

    const tokens = await this.generateTokens(
      user.id,
      user.email,
      user.organizationId ?? undefined,
      user.roleId ?? undefined,
      { rememberMe: loginDto.rememberMe === true },
    );

    return {
      user: {
        id: user.id,
        email: user.email,
        fullName: user.fullName,
        role: user.role?.name,
        mustChangePasswordOnFirstLogin: user.mustChangePasswordOnFirstLogin,
      },
      ...tokens,
    };
  }

  async googleLogin(googleUser: {
    googleId: string;
    email: string;
    fullName: string;
  }) {
    const { googleId, email, fullName } = googleUser;

    let user = await this.userRepo
      .createQueryBuilder("u")
      .leftJoinAndSelect("u.role", "role")
      .where("u.email = :email OR u.googleId = :googleId", { email, googleId })
      .getOne();

    if (!user) {
      const defaultRole = await this.roleRepo.findOne({
        where: { name: "player" },
      });
      if (!defaultRole) {
        throw new BadRequestException("Default role not found");
      }
      const created = await this.userRepo.save(
        this.userRepo.create({
          email,
          fullName,
          googleId,
          roleId: defaultRole.id,
          /** Placeholder until user completes profile; required by schema */
          phone: "+10000000000",
        }),
      );
      user = (await this.userRepo.findOne({
        where: { id: created.id },
        relations: ["role"],
      }))!;
    } else if (!user.googleId) {
      await this.userRepo.update(user.id, { googleId });
      user = (await this.userRepo.findOne({
        where: { id: user.id },
        relations: ["role"],
      }))!;
    }

    const tokens = await this.generateTokens(
      user.id,
      user.email,
      user.organizationId ?? undefined,
      user.roleId,
      { rememberMe: false },
    );

    return {
      user: {
        id: user.id,
        email: user.email,
        fullName: user.fullName,
        role: user.role?.name,
      },
      ...tokens,
    };
  }

  async forgotPassword(forgotPasswordDto: ForgotPasswordDto) {
    const { email } = forgotPasswordDto;
    const user = await this.userRepo.findOne({ where: { email } });

    if (!user) {
      return {
        message: "If the email exists, a password reset link has been sent",
      };
    }

    const token = crypto.randomBytes(32).toString("hex");
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 1);

    await this.resetTokenRepo.save(
      this.resetTokenRepo.create({
        userId: user.id,
        token,
        expiresAt,
      }),
    );

    const resetUrl = `${this.configService.get<string>("frontendUrl")}/reset-password?token=${token}`;
    await this.emailService.sendPasswordResetEmail(user.email, resetUrl);

    return {
      message: "If the email exists, a password reset link has been sent",
    };
  }

  async resetPassword(resetPasswordDto: ResetPasswordDto) {
    const { token, newPassword } = resetPasswordDto;

    const resetToken = await this.resetTokenRepo.findOne({
      where: { token },
      relations: ["user"],
    });

    if (!resetToken || resetToken.used || resetToken.expiresAt < new Date()) {
      throw new BadRequestException("Invalid or expired reset token");
    }

    const passwordHash = await bcrypt.hash(newPassword, 10);
    await this.userRepo.update(resetToken.userId, { passwordHash });
    await this.resetTokenRepo.update(resetToken.id, { used: true });

    return { message: "Password reset successfully" };
  }

  /** Validate password then send 6-digit OTP to email for second-step verification. */
  async requestLoginOtp(email: string, password: string) {
    const user = await this.validateUser(email, password);
    if (!user) {
      throw new UnauthorizedException("Invalid credentials");
    }
    const length = this.configService.get<number>("otp.loginLength", 6);
    const otp = crypto
      .randomInt(10 ** (length - 1), 10 ** length)
      .toString()
      .padStart(length, "0");
    this.otpStore.set(user.email, otp);
    try {
      await this.emailService.sendLoginOtpEmail(user.email, otp);
    } catch (err) {
      this.logger.error(
        `Send OTP email failed for ${user.email}: ${err instanceof Error ? err.message : String(err)}`,
        err instanceof Error ? err.stack : undefined,
      );
      throw new ServiceUnavailableException(
        "Unable to send verification email. Please try again later or contact support.",
      );
    }
    return {
      message: "OTP sent to your email. Please enter it to sign in.",
    };
  }

  /** Verify OTP and return tokens (login). */
  async verifyLoginOtp(email: string, otp: string, rememberMe?: boolean) {
    const user = await this.userRepo.findOne({
      where: { email: email.trim().toLowerCase() },
      relations: ["role"],
    });
    if (!user || user.status !== "active") {
      throw new UnauthorizedException("Invalid or expired OTP");
    }
    if (!this.otpStore.consume(user.email, otp)) {
      throw new UnauthorizedException("Invalid or expired OTP");
    }
    const tokens = await this.generateTokens(
      user.id,
      user.email,
      user.organizationId ?? undefined,
      user.roleId,
      { rememberMe: rememberMe === true },
    );
    return {
      user: {
        id: user.id,
        email: user.email,
        fullName: user.fullName,
        role: user.role?.name,
      },
      ...tokens,
    };
  }

  /**
   * Opaque refresh token from cookie/body: verify hash in Postgres, rotate, return new pair.
   */
  async refreshToken(rawRefreshToken: string) {
    const tokenHash = this.hashRefreshToken(rawRefreshToken);
    const row = await this.refreshTokenRepo.findOne({
      where: { tokenHash },
    });
    if (!row || row.expiresAt < new Date()) {
      throw new UnauthorizedException("Invalid refresh token");
    }

    const user = await this.userRepo.findOne({
      where: { id: row.userId },
      relations: ["role"],
    });
    if (!user || user.status !== "active") {
      await this.refreshTokenRepo.delete({ id: row.id });
      throw new UnauthorizedException("User not found or inactive");
    }

    await this.refreshTokenRepo.delete({ id: row.id });

    const tokens = await this.generateTokens(
      user.id,
      user.email,
      user.organizationId ?? undefined,
      user.roleId ?? undefined,
      { rememberMe: row.longSession },
    );

    return {
      ...tokens,
      longSession: row.longSession,
      user: {
        id: user.id,
        email: user.email,
        fullName: user.fullName,
        role: user.role?.name,
      },
    };
  }

  /**
   * Remove refresh row from Postgres; blacklist current access token jti in Redis until AT expiry.
   */
  async logout(accessToken?: string, rawRefreshToken?: string) {
    if (rawRefreshToken) {
      const tokenHash = this.hashRefreshToken(rawRefreshToken);
      await this.refreshTokenRepo.delete({ tokenHash });
    }
    if (accessToken) {
      try {
        const decoded = this.jwtService.decode(accessToken) as JwtPayload | null;
        if (decoded?.jti && decoded.exp) {
          const nowSec = Math.floor(Date.now() / 1000);
          const ttl = decoded.exp - nowSec;
          await this.redisService.blacklistAccessTokenJti(decoded.jti, ttl);
        }
      } catch {
        // ignore malformed token
      }
    }
  }

  private hashRefreshToken(raw: string): string {
    return crypto.createHash("sha256").update(raw, "utf8").digest("hex");
  }

  private refreshTtlMs(longSession: boolean): number {
    if (longSession) {
      return 30 * 24 * 60 * 60 * 1000;
    }
    return 7 * 24 * 60 * 60 * 1000;
  }

  private async generateTokens(
    userId: string,
    email: string,
    organizationId?: string,
    roleId?: string,
    options?: { rememberMe?: boolean },
  ) {
    const rememberMe = options?.rememberMe === true;
    const jti = crypto.randomUUID();
    const payload: JwtPayload = {
      sub: userId,
      email,
      organizationId,
      roleId,
      jti,
    };

    const accessToken = await this.jwtService.signAsync(payload, {
      secret: this.configService.get<string>("jwt.secret"),
      expiresIn: this.configService.get<string>("jwt.expiresIn"),
    });

    const refreshRaw = crypto.randomBytes(48).toString("base64url");
    const tokenHash = this.hashRefreshToken(refreshRaw);
    const expiresAt = new Date(Date.now() + this.refreshTtlMs(rememberMe));

    await this.refreshTokenRepo.save(
      this.refreshTokenRepo.create({
        userId,
        tokenHash,
        expiresAt,
        longSession: rememberMe,
      }),
    );

    return { accessToken, refreshToken: refreshRaw };
  }
}
