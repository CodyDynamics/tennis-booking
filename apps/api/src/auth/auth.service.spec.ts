import { Test, TestingModule } from "@nestjs/testing";
import { getRepositoryToken } from "@nestjs/typeorm";
import { JwtService } from "@nestjs/jwt";
import { ConfigService } from "@nestjs/config";
import { UnauthorizedException, BadRequestException } from "@nestjs/common";
import * as bcrypt from "bcrypt";

import { AuthService } from "./auth.service";
import { User } from "../users/entities/user.entity";
import { Role } from "../roles/entities/role.entity";
import { PasswordResetToken } from "./entities/password-reset-token.entity";
import { RefreshToken } from "./entities/refresh-token.entity";
import { EmailService } from "../email/email.service";
import { OtpStoreService } from "./otp-store.service";
import { RedisService } from "../redis/redis.service";
import { RegisterDto } from "./dto";

jest.mock("bcrypt", () => ({
  hash: jest.fn().mockResolvedValue("hashed-password"),
  compare: jest.fn().mockResolvedValue(true),
}));

describe("AuthService", () => {
  let service: AuthService;
  let userRepo: {
    find: jest.Mock;
    findOne: jest.Mock;
    save: jest.Mock;
    create: jest.Mock;
    update: jest.Mock;
  };
  let roleRepo: { findOne: jest.Mock };
  let resetTokenRepo: {
    findOne: jest.Mock;
    save: jest.Mock;
    create: jest.Mock;
    update: jest.Mock;
  };
  let jwtService: { signAsync: jest.Mock; verify: jest.Mock; decode: jest.Mock };
  let configService: { get: jest.Mock };
  let emailService: { sendPasswordResetEmail: jest.Mock };
  let refreshTokenRepo: {
    findOne: jest.Mock;
    save: jest.Mock;
    delete: jest.Mock;
    create: jest.Mock;
  };
  let otpStore: { set: jest.Mock; consume: jest.Mock };
  let redisService: {
    blacklistAccessTokenJti: jest.Mock;
    isAccessTokenJtiBlacklisted: jest.Mock;
  };

  const mockUser = {
    id: "user-uuid",
    email: "test@example.com",
    fullName: "Test User",
    passwordHash: "hashed",
    roleId: "role-uuid",
    organizationId: null,
    status: "active",
    role: { id: "role-uuid", name: "player" },
  } as User;

  const mockRole = { id: "role-uuid", name: "player" } as Role;

  beforeEach(async () => {
    userRepo = {
      find: jest.fn(),
      findOne: jest.fn(),
      save: jest.fn(),
      create: jest
        .fn()
        .mockImplementation((dto) => ({ ...dto, id: "new-user-id" })),
      update: jest.fn(),
    };
    roleRepo = { findOne: jest.fn() };
    resetTokenRepo = {
      findOne: jest.fn(),
      save: jest.fn(),
      create: jest.fn().mockImplementation((dto) => dto),
      update: jest.fn(),
    };
    jwtService = {
      signAsync: jest.fn().mockResolvedValue("token"),
      verify: jest.fn().mockReturnValue({ sub: mockUser.id }),
      decode: jest.fn().mockReturnValue(null),
    };
    configService = {
      get: jest.fn((key: string) => {
        const map: Record<string, string> = {
          "jwt.secret": "secret",
          "jwt.expiresIn": "1h",
          "jwt.refreshSecret": "refresh-secret",
          "jwt.refreshExpiresIn": "7d",
          frontendUrl: "http://localhost:3000",
        };
        return map[key];
      }),
    };
    emailService = {
      sendPasswordResetEmail: jest.fn().mockResolvedValue(undefined),
    };
    refreshTokenRepo = {
      findOne: jest.fn(),
      save: jest.fn().mockResolvedValue(undefined),
      delete: jest.fn().mockResolvedValue(undefined),
      create: jest.fn().mockImplementation((dto) => dto),
    };
    otpStore = {
      set: jest.fn(),
      consume: jest.fn(),
    };
    redisService = {
      blacklistAccessTokenJti: jest.fn().mockResolvedValue(undefined),
      isAccessTokenJtiBlacklisted: jest.fn().mockResolvedValue(false),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: getRepositoryToken(User), useValue: userRepo },
        { provide: getRepositoryToken(Role), useValue: roleRepo },
        {
          provide: getRepositoryToken(PasswordResetToken),
          useValue: resetTokenRepo,
        },
        {
          provide: getRepositoryToken(RefreshToken),
          useValue: refreshTokenRepo,
        },
        { provide: JwtService, useValue: jwtService },
        { provide: ConfigService, useValue: configService },
        { provide: EmailService, useValue: emailService },
        { provide: OtpStoreService, useValue: otpStore },
        { provide: RedisService, useValue: redisService },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
    jest.clearAllMocks();
  });

  it("should be defined", () => {
    expect(service).toBeDefined();
  });

  describe("register", () => {
    const registerDto: RegisterDto = {
      email: "new@example.com",
      password: "password123",
      fullName: "New User",
      roleId: "role-uuid",
    };

    it("should register a new user and return user + tokens", async () => {
      roleRepo.findOne.mockResolvedValue(mockRole);
      userRepo.find.mockResolvedValue([]);
      userRepo.save.mockResolvedValue({
        ...mockUser,
        id: "new-id",
        email: registerDto.email,
      });
      userRepo.findOne.mockResolvedValue({
        ...mockUser,
        id: "new-id",
        email: registerDto.email,
        fullName: registerDto.fullName,
        role: mockRole,
      });

      const result = await service.register(registerDto);

      expect(userRepo.find).toHaveBeenCalledWith({
        where: { email: registerDto.email },
      });
      expect(bcrypt.hash).toHaveBeenCalledWith(registerDto.password, 10);
      expect(userRepo.save).toHaveBeenCalled();
      expect(jwtService.signAsync).toHaveBeenCalledTimes(1);
      expect(result).toHaveProperty("user");
      expect(result).toHaveProperty("accessToken", "token");
      expect(typeof result.refreshToken).toBe("string");
      expect(refreshTokenRepo.save).toHaveBeenCalled();
    });

    it("should throw BadRequestException when email already exists", async () => {
      roleRepo.findOne.mockResolvedValue(mockRole);
      userRepo.find.mockResolvedValue([{ ...mockUser, organizationId: null }]);

      await expect(service.register(registerDto)).rejects.toThrow(
        BadRequestException,
      );
      await expect(service.register(registerDto)).rejects.toThrow(
        "User with this email already exists",
      );
      expect(userRepo.save).not.toHaveBeenCalled();
    });
  });

  describe("validateUser", () => {
    it("should return user without passwordHash when credentials are valid", async () => {
      userRepo.findOne.mockResolvedValue(mockUser);
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);

      const result = await service.validateUser("test@example.com", "password");

      expect(result).toBeDefined();
      expect(result).not.toHaveProperty("passwordHash");
      expect(result?.email).toBe(mockUser.email);
    });

    it("should return null when user not found", async () => {
      userRepo.findOne.mockResolvedValue(null);

      const result = await service.validateUser(
        "unknown@example.com",
        "password",
      );

      expect(result).toBeNull();
    });

    it("should return null when password is invalid", async () => {
      userRepo.findOne.mockResolvedValue(mockUser);
      (bcrypt.compare as jest.Mock).mockResolvedValue(false);

      const result = await service.validateUser("test@example.com", "wrong");

      expect(result).toBeNull();
    });

    it("should throw UnauthorizedException when account is inactive", async () => {
      userRepo.findOne.mockResolvedValue({ ...mockUser, status: "inactive" });
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);

      await expect(
        service.validateUser("test@example.com", "password"),
      ).rejects.toThrow(UnauthorizedException);
      await expect(
        service.validateUser("test@example.com", "password"),
      ).rejects.toThrow("Account is inactive");
    });
  });

  describe("login", () => {
    it("should return user and tokens on valid credentials", async () => {
      userRepo.findOne.mockResolvedValue(mockUser);
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);

      const result = await service.login({
        email: "test@example.com",
        password: "password123",
      });

      expect(result).toHaveProperty("user");
      expect(result).toHaveProperty("accessToken", "token");
      expect(typeof result.refreshToken).toBe("string");
    });

    it("should throw UnauthorizedException on invalid credentials", async () => {
      userRepo.findOne.mockResolvedValue(null);

      await expect(
        service.login({ email: "bad@example.com", password: "password123" }),
      ).rejects.toThrow(UnauthorizedException);
      await expect(
        service.login({ email: "bad@example.com", password: "password123" }),
      ).rejects.toThrow("Invalid credentials");
    });
  });

  describe("forgotPassword", () => {
    it("should send reset email when user exists", async () => {
      userRepo.findOne.mockResolvedValue(mockUser);
      resetTokenRepo.save.mockResolvedValue({});

      const result = await service.forgotPassword({
        email: "test@example.com",
      });

      expect(resetTokenRepo.save).toHaveBeenCalled();
      expect(emailService.sendPasswordResetEmail).toHaveBeenCalledWith(
        mockUser.email,
        expect.stringContaining("token="),
      );
      expect(result.message).toContain("password reset link");
    });

    it("should return same message when user does not exist (no leak)", async () => {
      userRepo.findOne.mockResolvedValue(null);

      const result = await service.forgotPassword({
        email: "nonexistent@example.com",
      });

      expect(resetTokenRepo.save).not.toHaveBeenCalled();
      expect(emailService.sendPasswordResetEmail).not.toHaveBeenCalled();
      expect(result.message).toContain("password reset link");
    });
  });

  describe("resetPassword", () => {
    it("should reset password when token is valid", async () => {
      const validToken = {
        id: "token-id",
        token: "reset-token",
        userId: mockUser.id,
        used: false,
        expiresAt: new Date(Date.now() + 3600000),
        user: mockUser,
      };
      resetTokenRepo.findOne.mockResolvedValue(validToken);

      const result = await service.resetPassword({
        token: "reset-token",
        newPassword: "newpassword123",
      });

      expect(bcrypt.hash).toHaveBeenCalledWith("newpassword123", 10);
      expect(userRepo.update).toHaveBeenCalledWith(
        mockUser.id,
        expect.any(Object),
      );
      expect(resetTokenRepo.update).toHaveBeenCalledWith(validToken.id, {
        used: true,
      });
      expect(result.message).toBe("Password reset successfully");
    });

    it("should throw BadRequestException when token is invalid or expired", async () => {
      resetTokenRepo.findOne.mockResolvedValue(null);

      await expect(
        service.resetPassword({
          token: "bad-token",
          newPassword: "newpass123",
        }),
      ).rejects.toThrow(BadRequestException);
      await expect(
        service.resetPassword({
          token: "bad-token",
          newPassword: "newpass123",
        }),
      ).rejects.toThrow("Invalid or expired reset token");
    });
  });

  describe("refreshToken", () => {
    it("should return new tokens when refresh token is valid", async () => {
      refreshTokenRepo.findOne.mockResolvedValue({
        id: "rt-id",
        userId: mockUser.id,
        tokenHash: "any",
        expiresAt: new Date(Date.now() + 86400000),
        longSession: false,
      });
      userRepo.findOne.mockResolvedValue(mockUser);

      const result = await service.refreshToken("valid-refresh-token");

      expect(refreshTokenRepo.delete).toHaveBeenCalledWith({ id: "rt-id" });
      expect(result).toHaveProperty("accessToken", "token");
      expect(typeof result.refreshToken).toBe("string");
      expect(result.longSession).toBe(false);
    });

    it("should throw UnauthorizedException when refresh token is invalid", async () => {
      refreshTokenRepo.findOne.mockResolvedValue(null);

      await expect(service.refreshToken("invalid-token")).rejects.toThrow(
        UnauthorizedException,
      );
      await expect(service.refreshToken("invalid-token")).rejects.toThrow(
        "Invalid refresh token",
      );
    });
  });
});
