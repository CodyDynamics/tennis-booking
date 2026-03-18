import {
  Injectable,
  UnauthorizedException,
  BadRequestException,
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
import {
  RegisterDto,
  LoginDto,
  ForgotPasswordDto,
  ResetPasswordDto,
} from "./dto";
import { EmailService } from "../email/email.service";

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(User)
    private userRepo: Repository<User>,
    @InjectRepository(Role)
    private roleRepo: Repository<Role>,
    @InjectRepository(PasswordResetToken)
    private resetTokenRepo: Repository<PasswordResetToken>,
    private jwtService: JwtService,
    private configService: ConfigService,
    private emailService: EmailService,
  ) {}

  async register(registerDto: RegisterDto) {
    const {
      email,
      password,
      fullName,
      phone,
      organizationId,
      branchId,
      roleId,
    } = registerDto;

    const role = await this.roleRepo.findOne({ where: { id: roleId } });
    if (!role) {
      throw new BadRequestException("Invalid role");
    }
    if (role.name === "admin" || role.name === "super_admin") {
      throw new BadRequestException(
      "Registration with admin or super_admin role is not allowed",
    );
    }

    const byEmail = await this.userRepo.find({ where: { email } });
    const existingUser = byEmail.find(
      (u) => (organizationId || null) === (u.organizationId || null),
    );
    if (existingUser) {
      throw new BadRequestException("User with this email already exists");
    }

    const passwordHash = await bcrypt.hash(password, 10);

    const user = await this.userRepo.save(
      this.userRepo.create({
        email,
        passwordHash,
        fullName,
        phone,
        organizationId,
        branchId,
        roleId,
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
      userWithRole.roleId,
    );

    return {
      user: {
        id: userWithRole.id,
        email: userWithRole.email,
        fullName: userWithRole.fullName,
        role: userWithRole.role.name,
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
      user.roleId,
    );

    return {
      user: {
        id: user.id,
        email: user.email,
        fullName: user.fullName,
        role: user.role.name,
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
    );

    return {
      user: {
        id: user.id,
        email: user.email,
        fullName: user.fullName,
        role: user.role.name,
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

  async refreshToken(refreshToken: string) {
    try {
      const payload = this.jwtService.verify(refreshToken, {
        secret: this.configService.get<string>("jwt.refreshSecret"),
      });

      const user = await this.userRepo.findOne({
        where: { id: payload.sub },
        relations: ["role"],
      });

      if (!user || user.status !== "active") {
        throw new UnauthorizedException("User not found or inactive");
      }

      const tokens = await this.generateTokens(
        user.id,
        user.email,
        user.organizationId ?? undefined,
        user.roleId,
      );
      return {
        ...tokens,
        user: {
          id: user.id,
          email: user.email,
          fullName: user.fullName,
          role: user.role.name,
        },
      };
    } catch {
      throw new UnauthorizedException("Invalid refresh token");
    }
  }

  private async generateTokens(
    userId: string,
    email: string,
    organizationId?: string,
    roleId?: string,
  ) {
    const payload: JwtPayload = {
      sub: userId,
      email,
      organizationId,
      roleId,
    };

    const [accessToken, refreshToken] = await Promise.all([
      this.jwtService.signAsync(payload, {
        secret: this.configService.get<string>("jwt.secret"),
        expiresIn: this.configService.get<string>("jwt.expiresIn"),
      }),
      this.jwtService.signAsync(payload, {
        secret: this.configService.get<string>("jwt.refreshSecret"),
        expiresIn: this.configService.get<string>("jwt.refreshExpiresIn"),
      }),
    ]);

    return { accessToken, refreshToken };
  }
}
