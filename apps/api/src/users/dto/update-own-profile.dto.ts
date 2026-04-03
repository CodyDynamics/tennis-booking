import { ApiPropertyOptional } from "@nestjs/swagger";
import { IsEmail, IsOptional, IsString, Matches } from "class-validator";

/** Self-service profile update (PATCH /users/profile). */
export class UpdateOwnProfileDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsEmail()
  email?: string;

  @ApiPropertyOptional({ example: "Jane" })
  @IsOptional()
  @IsString()
  firstName?: string;

  @ApiPropertyOptional({ example: "Doe" })
  @IsOptional()
  @IsString()
  lastName?: string;

  @ApiPropertyOptional({ example: "+15551234567" })
  @IsOptional()
  @IsString()
  @Matches(/^\+1\d{10}$/, {
    message: "Phone must be US E.164 (+1 followed by 10 digits)",
  })
  phone?: string;
}
