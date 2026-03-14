import { ApiProperty } from "@nestjs/swagger";
import { IsEmail, IsString, MinLength } from "class-validator";

export class LoginDto {
  @ApiProperty({ example: "user@example.com", description: "Login email" })
  @IsEmail()
  email: string;

  @ApiProperty({ example: "password123", minLength: 8, description: "Password" })
  @IsString()
  @MinLength(8)
  password: string;
}
