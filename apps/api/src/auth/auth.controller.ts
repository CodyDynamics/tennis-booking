import {
  Controller,
  Post,
  Body,
  UseGuards,
  Get,
  Req,
  Res,
  HttpCode,
  HttpStatus,
  UnauthorizedException,
} from "@nestjs/common";
import { AuthGuard } from "@nestjs/passport";
import { ApiTags, ApiOperation, ApiBody, ApiResponse } from "@nestjs/swagger";
import { ConfigService } from "@nestjs/config";
import { Request, Response } from "express";
import { Public } from "@app/common";
import { AuthService } from "./auth.service";
import {
  RegisterDto,
  LoginDto,
  ForgotPasswordDto,
  ResetPasswordDto,
  RefreshTokenDto,
  RequestLoginOtpDto,
  VerifyLoginOtpDto,
  VerifyRegisterOtpDto,
  ChangePasswordDto,
} from "./dto";
import { JwtAuthGuard, CurrentUser } from "@app/common";
import { AuthResponseDto } from "./dto/auth-response.dto";

@ApiTags("Auth")
@Controller("auth")
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly configService: ConfigService,
  ) {}

  private getCookieOpts() {
    const sameSite = this.configService.get<"lax" | "strict" | "none">(
      "cookie.sameSite",
      "lax",
    );
    return {
      httpOnly: true,
      path: "/",
      sameSite: sameSite as "lax" | "strict" | "none",
    };
  }

  /** Default: access 1h, refresh 7d. When rememberMe: true, refresh 30 days. */
  private setAuthCookies(
    res: Response,
    accessToken: string,
    refreshToken: string,
    rememberMe?: boolean,
  ) {
    const opts = this.getCookieOpts();
    const secure = this.configService.get<boolean>("cookie.secure", false);
    const accessName = this.configService.get<string>(
      "cookie.accessTokenName",
      "access_token",
    );
    const refreshName = this.configService.get<string>(
      "cookie.refreshTokenName",
      "refresh_token",
    );
    const accessMaxAge = this.configService.get<number>(
      "cookie.accessTokenMaxAgeSeconds",
      3600,
    );
    const defaultRefreshMaxAge = this.configService.get<number>(
      "cookie.refreshTokenMaxAgeSeconds",
      604800,
    );
    const refreshMaxAge = rememberMe ? 30 * 24 * 60 * 60 : defaultRefreshMaxAge;
    res.cookie(accessName, accessToken, {
      ...opts,
      secure,
      maxAge: accessMaxAge * 1000,
    });
    res.cookie(refreshName, refreshToken, {
      ...opts,
      secure,
      maxAge: refreshMaxAge * 1000,
    });
  }

  @Get("config")
  @Public()
  @ApiOperation({
    summary: "Public auth config (e.g. whether OTP login is enabled)",
  })
  @ApiResponse({ status: 200, description: "Auth config" })
  getConfig() {
    const loginOtpEnabled = this.configService.get<boolean>(
      "auth.loginOtpEnabled",
      false,
    );
    return { loginOtpEnabled };
  }

  private clearAuthCookies(res: Response) {
    const opts = this.getCookieOpts();
    const secure = this.configService.get<boolean>("cookie.secure", false);
    const accessName = this.configService.get<string>(
      "cookie.accessTokenName",
      "access_token",
    );
    const refreshName = this.configService.get<string>(
      "cookie.refreshTokenName",
      "refresh_token",
    );
    res.cookie(accessName, "", { ...opts, secure, maxAge: 0 });
    res.cookie(refreshName, "", { ...opts, secure, maxAge: 0 });
  }

  @Post("register/request-otp")
  @Public()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: "Start registration: validate data and send email verification code",
  })
  @ApiBody({ type: RegisterDto })
  @ApiResponse({ status: 200, description: "OTP sent to email" })
  async requestRegisterOtp(@Body() registerDto: RegisterDto) {
    return this.authService.requestRegisterOtp(registerDto);
  }

  @Post("register/verify-otp")
  @Public()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: "Complete registration after email OTP" })
  @ApiBody({ type: VerifyRegisterOtpDto })
  @ApiResponse({
    status: 201,
    description: "Registration successful",
    type: AuthResponseDto,
  })
  async verifyRegisterOtp(
    @Body() dto: VerifyRegisterOtpDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.authService.verifyRegisterOtp(dto.email, dto.otp);
    this.setAuthCookies(res, result.accessToken, result.refreshToken);
    return { user: result.user, accessToken: result.accessToken };
  }

  @Post("request-login-otp")
  @Public()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: "Validate password and send OTP to email for login",
  })
  @ApiBody({ type: RequestLoginOtpDto })
  @ApiResponse({ status: 200, description: "OTP sent to email" })
  @ApiResponse({ status: 401, description: "Invalid email or password" })
  async requestLoginOtp(@Body() dto: RequestLoginOtpDto) {
    return this.authService.requestLoginOtp(dto.email, dto.password);
  }

  @Post("verify-login-otp")
  @Public()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Verify OTP and login" })
  @ApiBody({ type: VerifyLoginOtpDto })
  @ApiResponse({
    status: 200,
    description: "Login successful",
    type: AuthResponseDto,
  })
  @ApiResponse({ status: 401, description: "Invalid or expired OTP" })
  async verifyLoginOtp(
    @Body() dto: VerifyLoginOtpDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.authService.verifyLoginOtp(
      dto.email,
      dto.otp,
      dto.rememberMe,
    );
    this.setAuthCookies(
      res,
      result.accessToken,
      result.refreshToken,
      dto.rememberMe,
    );
    return { user: result.user, accessToken: result.accessToken };
  }

  @Post("change-password")
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: "Change password while logged in (clears must-change-password flag)",
  })
  @ApiBody({ type: ChangePasswordDto })
  @ApiResponse({ status: 200, description: "Password updated" })
  @ApiResponse({ status: 401, description: "Wrong current password" })
  async changePassword(
    @CurrentUser() user: { id: string },
    @Body() dto: ChangePasswordDto,
  ) {
    return this.authService.changePassword(
      user.id,
      dto.currentPassword,
      dto.newPassword,
    );
  }

  @Post("login")
  @Public()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Login with password" })
  @ApiBody({ type: LoginDto })
  @ApiResponse({
    status: 200,
    description: "Login successful",
    type: AuthResponseDto,
  })
  @ApiResponse({ status: 401, description: "Invalid email or password" })
  async login(
    @Body() loginDto: LoginDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.authService.login(loginDto);
    this.setAuthCookies(
      res,
      result.accessToken,
      result.refreshToken,
      loginDto.rememberMe,
    );
    return { user: result.user, accessToken: result.accessToken };
  }

  @Get("google")
  @Public()
  @UseGuards(AuthGuard("google"))
  @ApiOperation({ summary: "Google login (redirect)" })
  @ApiResponse({ status: 302, description: "Redirect to Google OAuth" })
  async googleAuth() {
    // Initiates Google OAuth flow
  }

  @Get("google/callback")
  @Public()
  @UseGuards(AuthGuard("google"))
  @ApiOperation({ summary: "Callback after Google login" })
  @ApiResponse({
    status: 200,
    description: "Login successful",
    type: AuthResponseDto,
  })
  async googleAuthCallback(
    @Req() req,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.authService.googleLogin(req.user);
    this.setAuthCookies(res, result.accessToken, result.refreshToken);
    return { user: result.user, accessToken: result.accessToken };
  }

  @Post("logout")
  @Public()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Logout and clear auth cookies" })
  @ApiResponse({ status: 200, description: "Cookies cleared" })
  async logout(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const accessName = this.configService.get<string>(
      "cookie.accessTokenName",
      "access_token",
    );
    const refreshName = this.configService.get<string>(
      "cookie.refreshTokenName",
      "refresh_token",
    );
    const at = req.cookies?.[accessName];
    const rt = req.cookies?.[refreshName];
    await this.authService.logout(at, rt);
    this.clearAuthCookies(res);
    return { message: "Logged out" };
  }

  @Post("forgot-password")
  @Public()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Send forgot password email" })
  @ApiBody({ type: ForgotPasswordDto })
  @ApiResponse({ status: 200, description: "Email sent if account exists" })
  async forgotPassword(@Body() forgotPasswordDto: ForgotPasswordDto) {
    return this.authService.forgotPassword(forgotPasswordDto);
  }

  @Post("reset-password")
  @Public()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Reset password with token" })
  @ApiBody({ type: ResetPasswordDto })
  @ApiResponse({ status: 200, description: "Password reset successful" })
  @ApiResponse({ status: 400, description: "Invalid or expired token" })
  async resetPassword(@Body() resetPasswordDto: ResetPasswordDto) {
    return this.authService.resetPassword(resetPasswordDto);
  }

  @Post("refresh")
  @Public()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Refresh access token" })
  @ApiBody({ type: RefreshTokenDto })
  @ApiResponse({
    status: 200,
    description: "Returns new access token",
    type: AuthResponseDto,
  })
  @ApiResponse({ status: 401, description: "Invalid refresh token" })
  async refresh(
    @Body() refreshTokenDto: RefreshTokenDto,
    @Req() req: { cookies?: { refresh_token?: string } },
    @Res({ passthrough: true }) res: Response,
  ) {
    const refreshName = this.configService.get<string>(
      "cookie.refreshTokenName",
      "refresh_token",
    );
    const token = req.cookies?.[refreshName] ?? refreshTokenDto?.refreshToken;
    if (!token) {
      throw new UnauthorizedException("Refresh token required");
    }
    const result = await this.authService.refreshToken(token);
    this.setAuthCookies(
      res,
      result.accessToken,
      result.refreshToken,
      result.longSession,
    );
    return { user: result.user, accessToken: result.accessToken };
  }
}
