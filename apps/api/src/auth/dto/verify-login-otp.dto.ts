import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsEmail, IsString, Length, Matches, IsOptional, IsBoolean } from "class-validator";

export class VerifyLoginOtpDto {
  @ApiProperty({ example: "user@example.com", description: "Email that received the OTP" })
  @IsEmail()
  email: string;

  @ApiProperty({ example: "123456", description: "6-digit OTP from email", minLength: 6, maxLength: 6 })
  @IsString()
  @Length(6, 6, { message: "OTP must be 6 digits" })
  @Matches(/^\d{6}$/, { message: "OTP must contain only digits" })
  otp: string;

  @ApiPropertyOptional({ description: "When true, refresh cookie is set for 30 days" })
  @IsOptional()
  @IsBoolean()
  rememberMe?: boolean;
}
