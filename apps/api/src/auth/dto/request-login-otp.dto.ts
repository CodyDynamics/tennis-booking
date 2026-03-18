import { ApiProperty } from "@nestjs/swagger";
import { IsEmail, IsString, MinLength } from "class-validator";

export class RequestLoginOtpDto {
  @ApiProperty({ example: "user@example.com", description: "Email to receive OTP" })
  @IsEmail()
  email: string;

  @ApiProperty({ example: "password123", minLength: 8, description: "Password (validated before sending OTP)" })
  @IsString()
  @MinLength(8)
  password: string;
}
