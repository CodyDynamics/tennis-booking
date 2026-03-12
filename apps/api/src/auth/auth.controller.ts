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
import { Public } from "@app/common";
import { AuthService } from "./auth.service";
import {
  RegisterDto,
  LoginDto,
  ForgotPasswordDto,
  ResetPasswordDto,
  RefreshTokenDto,
} from "./dto";

@Controller("auth")
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post("register")
  @Public()
  @HttpCode(HttpStatus.CREATED)
  async register(@Body() registerDto: RegisterDto) {
    return this.authService.register(registerDto);
  }

  @Post("login")
  @Public()
  @HttpCode(HttpStatus.OK)
  async login(@Body() loginDto: LoginDto) {
    return this.authService.login(loginDto);
  }

  @Get("google")
  @Public()
  @UseGuards(AuthGuard("google"))
  async googleAuth() {
    // Initiates Google OAuth flow
  }

  @Get("google/callback")
  @Public()
  @UseGuards(AuthGuard("google"))
  async googleAuthCallback(@Req() req) {
    return this.authService.googleLogin(req.user);
  }

  @Post("forgot-password")
  @Public()
  @HttpCode(HttpStatus.OK)
  async forgotPassword(@Body() forgotPasswordDto: ForgotPasswordDto) {
    return this.authService.forgotPassword(forgotPasswordDto);
  }

  @Post("reset-password")
  @Public()
  @HttpCode(HttpStatus.OK)
  async resetPassword(@Body() resetPasswordDto: ResetPasswordDto) {
    return this.authService.resetPassword(resetPasswordDto);
  }

  @Post("refresh")
  @Public()
  @HttpCode(HttpStatus.OK)
  async refresh(@Body() refreshTokenDto: RefreshTokenDto) {
    return this.authService.refreshToken(refreshTokenDto.refreshToken);
  }
}
