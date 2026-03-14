import {
  Controller,
  Post,
  Body,
  UseGuards,
  Get,
  Req,
  HttpCode,
  HttpStatus,
} from "@nestjs/common";
import { AuthGuard } from "@nestjs/passport";
import { ApiTags, ApiOperation, ApiBody, ApiResponse } from "@nestjs/swagger";
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
  constructor(private readonly authService: AuthService) {}

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
  async register(@Body() registerDto: RegisterDto) {
    return this.authService.register(registerDto);
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
  async login(@Body() loginDto: LoginDto) {
    return this.authService.login(loginDto);
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
  async googleAuthCallback(@Req() req) {
    return this.authService.googleLogin(req.user);
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
  async refresh(@Body() refreshTokenDto: RefreshTokenDto) {
    return this.authService.refreshToken(refreshTokenDto.refreshToken);
  }
}
