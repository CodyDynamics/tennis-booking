import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsEmail, IsString, MinLength, IsOptional, IsBoolean } from "class-validator";

export class LoginDto {
  @ApiProperty({ example: "user@example.com", description: "Login email" })
  @IsEmail()
  email: string;

  @ApiProperty({ example: "password123", minLength: 8, description: "Password" })
  @IsString()
  @MinLength(8)
  password: string;

  @ApiPropertyOptional({ description: "When true, keep user logged in longer (e.g. 30 days)" })
  @IsOptional()
  @IsBoolean()
  rememberMe?: boolean;
}
