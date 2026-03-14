import { ApiProperty } from "@nestjs/swagger";
import { IsString, MinLength } from "class-validator";

export class ResetPasswordDto {
  @ApiProperty({ description: "Reset token from email" })
  @IsString()
  token: string;

  @ApiProperty({ example: "newPassword123", minLength: 8, description: "New password" })
  @IsString()
  @MinLength(8)
  newPassword: string;
}
