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
import { Response } from "express";
import { Public } from "@app/common";
import { AuthService } from "./auth.service";
import {
  RegisterDto,
  LoginDto,
  ForgotPasswordDto,
  ResetPasswordDto,
  RefreshTokenDto,
} from "./dto";
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

  @Post("register")
  @Public()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: "Register account" })
  @ApiBody({ type: RegisterDto })
  @ApiResponse({
    status: 201,
    description: "Registration successful",
    type: AuthResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: "Invalid data or email already exists",
  })
  async register(
    @Body() registerDto: RegisterDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.authService.register(registerDto);
    this.setAuthCookies(res, result.accessToken, result.refreshToken);
    return { user: result.user };
  }

  @Post("login")
  @Public()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Login" })
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
    return { user: result.user };
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
    return { user: result.user };
  }

  @Post("logout")
  @Public()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Logout and clear auth cookies" })
  @ApiResponse({ status: 200, description: "Cookies cleared" })
  logout(@Res({ passthrough: true }) res: Response) {
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
    this.setAuthCookies(res, result.accessToken, result.refreshToken);
    return { user: result.user };
  }
}
