import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import {
  IsEmail,
  IsString,
  IsOptional,
  IsUUID,
  IsNotEmpty,
  Matches,
} from "class-validator";

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

  @ApiPropertyOptional({ description: "Optional location membership" })
  @IsOptional()
  @IsUUID()
  membershipLocationId?: string;

  @ApiPropertyOptional({ description: "Join date YYYY-MM-DD" })
  @IsOptional()
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  membershipJoinDate?: string;

  @ApiPropertyOptional({ description: "End date YYYY-MM-DD" })
  @IsOptional()
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  membershipEndDate?: string;
}
