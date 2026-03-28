import { ApiProperty } from "@nestjs/swagger";
import { IsEmail, IsString, Length, Matches } from "class-validator";

export class VerifyRegisterOtpDto {
  @ApiProperty({ example: "user@example.com" })
  @IsEmail()
  email: string;

  @ApiProperty({ example: "123456", description: "6-digit code from email" })
  @IsString()
  @Length(6, 6, { message: "OTP must be 6 digits" })
  @Matches(/^\d{6}$/, { message: "OTP must contain only digits" })
  otp: string;
}
