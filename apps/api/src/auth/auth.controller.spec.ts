import { Test, TestingModule } from "@nestjs/testing";
import { ConfigService } from "@nestjs/config";
import { AuthController } from "./auth.controller";
import { AuthService } from "./auth.service";
import {
  RegisterDto,
  LoginDto,
  ForgotPasswordDto,
  ResetPasswordDto,
  RefreshTokenDto,
} from "./dto";

const mockRes = (): import("express").Response => {
  const res: any = {};
  res.cookie = jest.fn().mockReturnValue(res);
  res.status = jest.fn().mockReturnValue(res);
  return res;
};

const mockConfigService = {
  get: jest.fn((key: string, defaultValue?: unknown) => {
    const map: Record<string, unknown> = {
      "cookie.secure": false,
      "cookie.sameSite": "lax",
      "cookie.accessTokenName": "access_token",
      "cookie.refreshTokenName": "refresh_token",
      "cookie.accessTokenMaxAgeSeconds": 3600,
      "cookie.refreshTokenMaxAgeSeconds": 604800,
    };
    return map[key] ?? defaultValue;
  }),
};

describe("AuthController", () => {
  let controller: AuthController;
  let authService: AuthService;

  const mockAuthService = {
    requestRegisterOtp: jest.fn(),
    verifyRegisterOtp: jest.fn(),
    login: jest.fn(),
    googleLogin: jest.fn(),
    forgotPassword: jest.fn(),
    resetPassword: jest.fn(),
    refreshToken: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [
        {
          provide: AuthService,
          useValue: mockAuthService,
        },
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
      ],
    }).compile();

    controller = module.get<AuthController>(AuthController);
    authService = module.get<AuthService>(AuthService);
    jest.clearAllMocks();
  });

  it("should be defined", () => {
    expect(controller).toBeDefined();
  });

  describe("requestRegisterOtp", () => {
    it("should call authService.requestRegisterOtp with body", async () => {
      const dto: RegisterDto = {
        email: "test@example.com",
        password: "password123",
        fullName: "Test",
        phone: "+15550000000",
        street: "1 Main",
        city: "Austin",
        state: "TX",
        zipCode: "78701",
      };
      mockAuthService.requestRegisterOtp.mockResolvedValue({ message: "ok" });

      const res = mockRes();
      await controller.requestRegisterOtp(dto, res);

      expect(authService.requestRegisterOtp).toHaveBeenCalledWith(dto);
    });
  });

  describe("verifyRegisterOtp", () => {
    it("should call authService.verifyRegisterOtp and set cookies", async () => {
      mockAuthService.verifyRegisterOtp.mockResolvedValue({
        user: {},
        accessToken: "x",
        refreshToken: "y",
      });

      const res = mockRes();
      await controller.verifyRegisterOtp(
        { email: "test@example.com", otp: "123456" },
        res,
      );

      expect(authService.verifyRegisterOtp).toHaveBeenCalledWith(
        "test@example.com",
        "123456",
      );
    });
  });

  describe("login", () => {
    it("should call authService.login with body", async () => {
      const dto: LoginDto = {
        email: "test@example.com",
        password: "password123",
      };
      mockAuthService.login.mockResolvedValue({
        user: {},
        accessToken: "x",
        refreshToken: "y",
      });

      const res = mockRes();
      await controller.login(dto, res);

      expect(authService.login).toHaveBeenCalledWith(dto);
    });
  });

  describe("googleAuthCallback", () => {
    it("should call authService.googleLogin with req.user", async () => {
      const googleUser = {
        googleId: "gid",
        email: "g@example.com",
        fullName: "Google User",
      };
      mockAuthService.googleLogin.mockResolvedValue({
        user: {},
        accessToken: "x",
        refreshToken: "y",
      });

      const res = mockRes();
      await controller.googleAuthCallback({ user: googleUser } as any, res);

      expect(authService.googleLogin).toHaveBeenCalledWith(googleUser);
    });
  });

  describe("forgotPassword", () => {
    it("should call authService.forgotPassword with body", async () => {
      const dto: ForgotPasswordDto = { email: "test@example.com" };
      mockAuthService.forgotPassword.mockResolvedValue({ message: "ok" });

      await controller.forgotPassword(dto);

      expect(authService.forgotPassword).toHaveBeenCalledWith(dto);
    });
  });

  describe("resetPassword", () => {
    it("should call authService.resetPassword with body", async () => {
      const dto: ResetPasswordDto = { token: "t", newPassword: "newpass123" };
      mockAuthService.resetPassword.mockResolvedValue({
        message: "Password reset successfully",
      });

      await controller.resetPassword(dto);

      expect(authService.resetPassword).toHaveBeenCalledWith(dto);
    });
  });

  describe("refresh", () => {
    it("should call authService.refreshToken with refreshToken from body", async () => {
      const dto: RefreshTokenDto = { refreshToken: "refresh-token" };
      mockAuthService.refreshToken.mockResolvedValue({
        accessToken: "x",
        refreshToken: "y",
        user: {},
      });

      const req = { cookies: {} };
      const res = mockRes();
      await controller.refresh(dto, req, res);

      expect(authService.refreshToken).toHaveBeenCalledWith(dto.refreshToken);
    });
  });
});
