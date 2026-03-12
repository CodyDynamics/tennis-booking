import { Test, TestingModule } from "@nestjs/testing";
import { AuthController } from "./auth.controller";
import { AuthService } from "./auth.service";
import {
  RegisterDto,
  LoginDto,
  ForgotPasswordDto,
  ResetPasswordDto,
  RefreshTokenDto,
} from "./dto";

describe("AuthController", () => {
  let controller: AuthController;
  let authService: AuthService;

  const mockAuthService = {
    register: jest.fn(),
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
      ],
    }).compile();

    controller = module.get<AuthController>(AuthController);
    authService = module.get<AuthService>(AuthService);
    jest.clearAllMocks();
  });

  it("should be defined", () => {
    expect(controller).toBeDefined();
  });

  describe("register", () => {
    it("should call authService.register with body", async () => {
      const dto: RegisterDto = {
        email: "test@example.com",
        password: "password123",
        fullName: "Test",
        roleId: "role-uuid",
      };
      mockAuthService.register.mockResolvedValue({
        user: {},
        accessToken: "x",
        refreshToken: "y",
      });

      await controller.register(dto);

      expect(authService.register).toHaveBeenCalledWith(dto);
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

      await controller.login(dto);

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

      await controller.googleAuthCallback({ user: googleUser } as any);

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
      });

      await controller.refresh(dto);

      expect(authService.refreshToken).toHaveBeenCalledWith(dto.refreshToken);
    });
  });
});
