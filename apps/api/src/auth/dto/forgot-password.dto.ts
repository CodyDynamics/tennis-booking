import { ApiProperty } from "@nestjs/swagger";
import { IsEmail } from "class-validator";

export class ForgotPasswordDto {
  @ApiProperty({ example: "user@example.com", description: "Email to send password reset" })
  @IsEmail()
  email: string;
}
