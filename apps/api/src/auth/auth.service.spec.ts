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
import { RegisterPendingStoreService } from "./register-pending-store.service";
import { RedisService } from "../redis/redis.service";
import { RolesService } from "../roles/roles.service";
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
  let jwtService: {
    signAsync: jest.Mock;
    verify: jest.Mock;
    decode: jest.Mock;
  };
  let configService: { get: jest.Mock };
  let emailService: {
    sendPasswordResetEmail: jest.Mock;
    sendLoginOtpEmail: jest.Mock;
    sendRegistrationOtpEmail: jest.Mock;
  };
  let refreshTokenRepo: {
    findOne: jest.Mock;
    save: jest.Mock;
    delete: jest.Mock;
    create: jest.Mock;
  };
  let otpStore: { set: jest.Mock; consume: jest.Mock; clear: jest.Mock };
  let registerPendingStore: {
    set: jest.Mock;
    get: jest.Mock;
    delete: jest.Mock;
  };
  let redisService: {
    blacklistAccessTokenJti: jest.Mock;
    isAccessTokenJtiBlacklisted: jest.Mock;
  };
  let rolesService: { findByName: jest.Mock };

  const mockUser = {
    id: "user-uuid",
    email: "test@example.com",
    fullName: "Test User",
    phone: "+15550000000",
    passwordHash: "hashed",
    roleId: "role-uuid",
    status: "active",
    role: { id: "role-uuid", name: "player" },
  } as unknown as User;

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
      get: jest.fn((key: string, defaultValue?: unknown) => {
        const map: Record<string, unknown> = {
          "jwt.secret": "secret",
          "jwt.expiresIn": "1h",
          "jwt.refreshSecret": "refresh-secret",
          "jwt.refreshExpiresIn": "7d",
          frontendUrl: "http://localhost:3000",
          "otp.loginLength": 6,
          "otp.loginTtlSeconds": 300,
        };
        return map[key] ?? defaultValue;
      }),
    };
    emailService = {
      sendPasswordResetEmail: jest.fn().mockResolvedValue(undefined),
      sendLoginOtpEmail: jest.fn().mockResolvedValue(undefined),
      sendRegistrationOtpEmail: jest.fn().mockResolvedValue(undefined),
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
      clear: jest.fn(),
    };
    registerPendingStore = {
      set: jest.fn(),
      get: jest.fn(),
      delete: jest.fn(),
    };
    redisService = {
      blacklistAccessTokenJti: jest.fn().mockResolvedValue(undefined),
      isAccessTokenJtiBlacklisted: jest.fn().mockResolvedValue(false),
    };
    rolesService = {
      findByName: jest
        .fn()
        .mockResolvedValue({ id: "player-role-id", name: "player" }),
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
        {
          provide: RegisterPendingStoreService,
          useValue: registerPendingStore,
        },
        { provide: RedisService, useValue: redisService },
        { provide: RolesService, useValue: rolesService },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
    jest.clearAllMocks();
  });

  it("should be defined", () => {
    expect(service).toBeDefined();
  });

  describe("requestRegisterOtp", () => {
    const registerDto: RegisterDto = {
      email: "new@example.com",
      password: "password123",
      fullName: "New User",
      firstName: "New",
      lastName: "User",
      phone: "+15550000001",
      street: "1 Main St",
      city: "Austin",
      state: "TX",
      zipCode: "78701",
    };

    it("should store pending registration and send OTP email", async () => {
      userRepo.findOne.mockResolvedValue(null);

      const result = await service.requestRegisterOtp(registerDto);

      expect(userRepo.findOne).toHaveBeenCalledWith({
        where: { email: "new@example.com" },
      });
      expect(bcrypt.hash).toHaveBeenCalledWith(registerDto.password, 10);
      expect(registerPendingStore.set).toHaveBeenCalled();
      expect(otpStore.set).toHaveBeenCalledWith(
        "register",
        "new@example.com",
        expect.any(String),
      );
      expect(emailService.sendRegistrationOtpEmail).toHaveBeenCalled();
      expect("message" in result).toBe(true);
      if ("message" in result) {
        expect(result.message).toContain("verification code");
      }
    });

    it("should throw BadRequestException when email already exists", async () => {
      userRepo.findOne.mockResolvedValue(mockUser);

      await expect(service.requestRegisterOtp(registerDto)).rejects.toThrow(
        BadRequestException,
      );
      expect(registerPendingStore.set).not.toHaveBeenCalled();
    });

    it("should complete registration without OTP when SEND_REGISTRATION_EMAIL is off", async () => {
      userRepo.findOne
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce({
          ...mockUser,
          id: "new-id",
          email: "new@example.com",
          fullName: "New User",
          roleId: "player-role-id",
          role: { id: "player-role-id", name: "player" },
        });
      userRepo.save.mockResolvedValue({
        ...mockUser,
        id: "new-id",
        email: "new@example.com",
        roleId: "player-role-id",
      });
      const prev = process.env.SEND_REGISTRATION_EMAIL;
      process.env.SEND_REGISTRATION_EMAIL = "false";
      try {
        const result = await service.requestRegisterOtp(registerDto);

        expect(emailService.sendRegistrationOtpEmail).not.toHaveBeenCalled();
        expect(registerPendingStore.set).not.toHaveBeenCalled();
        expect(otpStore.set).not.toHaveBeenCalled();
        expect(userRepo.save).toHaveBeenCalled();
        expect(jwtService.signAsync).toHaveBeenCalled();
        expect(result).toHaveProperty("accessToken", "token");
        expect(result).toHaveProperty("user");
      } finally {
        if (prev === undefined) {
          delete process.env.SEND_REGISTRATION_EMAIL;
        } else {
          process.env.SEND_REGISTRATION_EMAIL = prev;
        }
      }
    });
  });

  describe("verifyRegisterOtp", () => {
    const pending = {
      passwordHash: "hashed-password",
      fullName: "New User",
      firstName: "New",
      lastName: "User",
      phone: "+15550000001",
      homeAddress: "1 Main St, Austin, TX 78701",
      expiresAt: Date.now() + 60_000,
    };

    it("should create user and return tokens when OTP and pending are valid", async () => {
      registerPendingStore.get.mockReturnValue(pending);
      otpStore.consume.mockReturnValue(true);
      userRepo.findOne.mockResolvedValueOnce(null).mockResolvedValueOnce({
        ...mockUser,
        id: "new-id",
        email: "new@example.com",
        fullName: "New User",
        roleId: "player-role-id",
        role: { id: "player-role-id", name: "player" },
      });
      userRepo.save.mockResolvedValue({
        ...mockUser,
        id: "new-id",
        email: "new@example.com",
        roleId: "player-role-id",
      });

      const result = await service.verifyRegisterOtp(
        "new@example.com",
        "123456",
      );

      expect(registerPendingStore.delete).toHaveBeenCalledWith(
        "new@example.com",
      );
      expect(userRepo.save).toHaveBeenCalled();
      expect(jwtService.signAsync).toHaveBeenCalled();
      expect(result).toHaveProperty("user");
      expect(result).toHaveProperty("accessToken", "token");
    });

    it("should throw when registration session expired", async () => {
      registerPendingStore.get.mockReturnValue(null);

      await expect(
        service.verifyRegisterOtp("new@example.com", "123456"),
      ).rejects.toThrow(BadRequestException);
      expect(otpStore.consume).not.toHaveBeenCalled();
    });

    it("should throw when OTP is invalid", async () => {
      registerPendingStore.get.mockReturnValue(pending);
      otpStore.consume.mockReturnValue(false);

      await expect(
        service.verifyRegisterOtp("new@example.com", "000000"),
      ).rejects.toThrow(UnauthorizedException);
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
  });
});
