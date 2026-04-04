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
import {
  RegisterPendingStoreService,
  type PendingRegisterPayload,
} from "./register-pending-store.service";
import { RolesService } from "../roles/roles.service";
import { UserAccountType } from "../users/entities/user-account-type.enum";
import { isSendRegistrationEmailEnabled } from "../config/configuration";

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
    private registerPendingStore: RegisterPendingStoreService,
    private redisService: RedisService,
    private rolesService: RolesService,
  ) {}

  private last10Digits(phone: string): string {
    const d = (phone || "").replace(/\D/g, "");
    return d.length >= 10 ? d.slice(-10) : d;
  }

  private phonesMatch(a: string, b: string): boolean {
    const na = this.last10Digits(a);
    const nb = this.last10Digits(b);
    return na.length === 10 && nb.length === 10 && na === nb;
  }

  private formatHomeAddress(
    street: string,
    city: string,
    state: string,
    zipCode: string,
  ): string {
    const line2 = `${state.trim()} ${zipCode.trim()}`.trim();
    return [street.trim(), city.trim(), line2].filter(Boolean).join(", ");
  }

  /** User-facing hint when transactional mail fails (e.g. Gmail API invalid_grant). */
  private mailSendFailureUserMessage(err: unknown): string {
    const raw = err instanceof Error ? err.message : String(err);
    if (/unauthorized_client/i.test(raw)) {
      return "Could not send email: unauthorized_client — the refresh token does not match GOOGLE_CLIENT_ID/SECRET in .env. In OAuth Playground, enable “Use your own OAuth credentials” with the same Client ID and Secret as this app, then generate a new refresh token. Tokens from Playground default credentials will not work with your Cloud Console client.";
    }
    if (/invalid_grant/i.test(raw)) {
      return "Could not send email: Google refresh token expired or revoked (invalid_grant). Regenerate GOOGLE_REFRESH_TOKEN in Google OAuth Playground, or use MAIL_PROVIDER=smtp with a Gmail app password instead of cloud.";
    }
    if (/Mail provider is none/i.test(raw)) {
      return "Email is not configured on the server. Set RESEND_API_KEY or SMTP (EMAIL_HOST, EMAIL_USER, EMAIL_PASSWORD), or use SEND_REGISTRATION_EMAIL=false if OTP by email is not required.";
    }
    return "Unable to send verification email. Please try again later or contact support.";
  }

  /** Allow OTP signup if email is new, or matches a membership placeholder (no password yet). */
  private async assertEmailAllowedForRegistrationRequest(
    email: string,
  ): Promise<void> {
    const existingUser = await this.userRepo.findOne({ where: { email } });
    if (!existingUser) return;
    if (
      existingUser.accountType === UserAccountType.MEMBERSHIP &&
      !existingUser.passwordHash
    ) {
      return;
    }
    throw new BadRequestException("User with this email already exists");
  }

  /**
   * Step 1: validate data; either send email OTP (then user completes via verifyRegisterOtp)
   * or, when SEND_REGISTRATION_EMAIL is off, create the user and return tokens immediately.
   */
  async requestRegisterOtp(registerDto: RegisterDto) {
    const email = registerDto.email.trim().toLowerCase();
    const {
      password,
      fullName,
      firstName,
      lastName,
      phone,
      street,
      city,
      state,
      zipCode,
    } = registerDto;

    await this.assertEmailAllowedForRegistrationRequest(email);

    const passwordHash = await bcrypt.hash(password, 10);
    const resolvedFirstName =
      firstName?.trim() || fullName.trim().split(/\s+/)[0] || null;
    const resolvedLastName =
      lastName?.trim() ||
      fullName.trim().split(/\s+/).slice(1).join(" ").trim() ||
      null;
    const homeAddress = this.formatHomeAddress(street, city, state, zipCode);

    const pendingFields = {
      passwordHash,
      fullName: fullName.trim(),
      firstName: resolvedFirstName,
      lastName: resolvedLastName,
      phone,
      homeAddress,
    };

    if (!isSendRegistrationEmailEnabled()) {
      this.logger.log(
        `SEND_REGISTRATION_EMAIL=false: registering ${email} without email OTP`,
      );
      const pending: PendingRegisterPayload = {
        ...pendingFields,
        expiresAt: Date.now() + 60_000,
      };
      return this.completeRegistrationFromPending(email, pending);
    }

    this.registerPendingStore.set(email, pendingFields);

    const length = this.configService.get<number>("otp.loginLength", 6);
    const otp = crypto
      .randomInt(10 ** (length - 1), 10 ** length)
      .toString()
      .padStart(length, "0");
    this.otpStore.set("register", email, otp);

    try {
      await this.emailService.sendRegistrationOtpEmail(email, otp);
    } catch (err) {
      this.registerPendingStore.delete(email);
      this.otpStore.clear("register", email);
      this.logger.error(
        `Send registration OTP failed for ${email}: ${err instanceof Error ? err.message : String(err)}`,
        err instanceof Error ? err.stack : undefined,
      );
      throw new ServiceUnavailableException(this.mailSendFailureUserMessage(err));
    }

    return {
      message:
        "We sent a verification code to your email. Enter it to complete registration.",
    };
  }

  /** Step 2: verify OTP and persist the user. */
  async verifyRegisterOtp(emailRaw: string, otp: string) {
    const email = emailRaw.trim().toLowerCase();
    const pending = this.registerPendingStore.get(email);
    if (!pending) {
      throw new BadRequestException(
        "Registration session expired. Please submit the form again.",
      );
    }
    if (!this.otpStore.consume("register", email, otp)) {
      throw new UnauthorizedException("Invalid or expired verification code");
    }
    this.registerPendingStore.delete(email);
    return this.completeRegistrationFromPending(email, pending);
  }

  private async completeRegistrationFromPending(
    email: string,
    pending: PendingRegisterPayload,
  ) {
    const existing = await this.userRepo.findOne({
      where: { email },
      relations: ["role"],
    });

    if (existing) {
      if (
        existing.accountType === UserAccountType.MEMBERSHIP &&
        !existing.passwordHash &&
        this.phonesMatch(existing.phone, pending.phone)
      ) {
        await this.userRepo.update(existing.id, {
          passwordHash: pending.passwordHash,
          fullName: pending.fullName,
          firstName: pending.firstName,
          lastName: pending.lastName,
          phone: pending.phone,
          homeAddress: pending.homeAddress,
        });
        const userWithRole = await this.userRepo.findOne({
          where: { id: existing.id },
          relations: ["role"],
        });
        if (!userWithRole) throw new BadRequestException("User not found");
        const tokens = await this.generateTokens(
          userWithRole.id,
          userWithRole.email,
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
      throw new BadRequestException("User with this email already exists");
    }

    const playerRole = await this.rolesService.findByName("player");
    const user = await this.userRepo.save(
      this.userRepo.create({
        email,
        passwordHash: pending.passwordHash,
        fullName: pending.fullName,
        firstName: pending.firstName,
        lastName: pending.lastName,
        phone: pending.phone,
        homeAddress: pending.homeAddress,
        roleId: playerRole?.id ?? null,
        courtId: null,
        visibility: "public",
        accountType: UserAccountType.NORMAL,
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
    if (!user?.passwordHash) return null;

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) return null;

    if (user.status !== "active") {
      throw new UnauthorizedException("Account is inactive");
    }

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { passwordHash: _, ...result } = user;
    return result;
  }

  async changePassword(
    userId: string,
    currentPassword: string,
    newPassword: string,
  ) {
    const user = await this.userRepo.findOne({ where: { id: userId } });
    if (!user?.passwordHash) {
      throw new BadRequestException(
        "This account has no password set; use Google sign-in or reset password.",
      );
    }
    const valid = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!valid) {
      throw new UnauthorizedException("Current password is incorrect");
    }
    const passwordHash = await bcrypt.hash(newPassword, 10);
    await this.userRepo.update(userId, {
      passwordHash,
      mustChangePasswordOnFirstLogin: false,
    });
    return { message: "Password updated" };
  }

  async login(loginDto: LoginDto) {
    const user = await this.validateUser(loginDto.email, loginDto.password);
    if (!user) {
      throw new UnauthorizedException("Invalid credentials");
    }

    const tokens = await this.generateTokens(
      user.id,
      user.email,
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
          accountType: UserAccountType.NORMAL,
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

    const tokens = await this.generateTokens(user.id, user.email, user.roleId, {
      rememberMe: false,
    });

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
    await this.userRepo.update(resetToken.userId, {
      passwordHash,
      mustChangePasswordOnFirstLogin: false,
    });
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
    this.otpStore.set("login", user.email, otp);
    try {
      await this.emailService.sendLoginOtpEmail(user.email, otp);
    } catch (err) {
      this.logger.error(
        `Send OTP email failed for ${user.email}: ${err instanceof Error ? err.message : String(err)}`,
        err instanceof Error ? err.stack : undefined,
      );
      throw new ServiceUnavailableException(this.mailSendFailureUserMessage(err));
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
    if (!this.otpStore.consume("login", user.email, otp)) {
      throw new UnauthorizedException("Invalid or expired OTP");
    }
    const tokens = await this.generateTokens(user.id, user.email, user.roleId, {
      rememberMe: rememberMe === true,
    });
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
        mustChangePasswordOnFirstLogin: user.mustChangePasswordOnFirstLogin,
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
        const decoded = this.jwtService.decode(
          accessToken,
        ) as JwtPayload | null;
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
    roleId?: string,
    options?: { rememberMe?: boolean },
  ) {
    const rememberMe = options?.rememberMe === true;
    const jti = crypto.randomUUID();
    const payload: JwtPayload = {
      sub: userId,
      email,
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
