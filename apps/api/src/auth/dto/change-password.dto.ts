import { ApiProperty } from "@nestjs/swagger";
import { IsString, MinLength } from "class-validator";

export class ChangePasswordDto {
  @ApiProperty({ minLength: 8, description: "Existing password" })
  @IsString()
  @MinLength(1)
  currentPassword: string;

  @ApiProperty({ example: "newPassword123", minLength: 8, description: "New password" })
  @IsString()
  @MinLength(8)
  newPassword: string;
}
