import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsEmail, IsString, IsOptional, IsUUID, IsNotEmpty } from "class-validator";

/** Pre-add a member (email + phone); user sets password via public /register OTP. */
export class CreateMembershipPlaceholderDto {
  @ApiProperty()
  @IsEmail()
  email: string;

  @ApiProperty({ example: "+15551234567" })
  @IsString()
  @IsNotEmpty()
  phone: string;

  @ApiProperty({ example: "Jane Member" })
  @IsString()
  @IsNotEmpty()
  fullName: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  firstName?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  lastName?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  homeAddress?: string;

  @ApiPropertyOptional({ description: "Optional venue (child location) membership" })
  @IsOptional()
  @IsUUID()
  membershipLocationId?: string;
}
