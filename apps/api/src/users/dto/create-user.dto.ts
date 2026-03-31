import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import {
  IsEmail,
  IsString,
  MinLength,
  IsOptional,
  IsUUID,
  IsBoolean,
} from "class-validator";

export class CreateUserDto {
  @ApiProperty({ example: "user@example.com" })
  @IsEmail()
  email: string;

  @ApiProperty({ example: "password123", minLength: 8 })
  @IsString()
  @MinLength(8)
  password: string;

  @ApiProperty({ example: "John Doe" })
  @IsString()
  fullName: string;

  @ApiPropertyOptional({ example: "John" })
  @IsOptional()
  @IsString()
  firstName?: string;

  @ApiPropertyOptional({ example: "Doe" })
  @IsOptional()
  @IsString()
  lastName?: string;

  @ApiProperty({ example: "+15551234567" })
  @IsString()
  phone: string;

  @ApiPropertyOptional({ description: "Residential address (optional)" })
  @IsOptional()
  @IsString()
  homeAddress?: string;

  @ApiProperty({ description: "Role UUID" })
  @IsUUID()
  roleId: string;

  @ApiPropertyOptional({
    description: "If true, user must change password after first successful login.",
  })
  @IsOptional()
  @IsBoolean()
  mustChangePasswordOnFirstLogin?: boolean;

  @ApiPropertyOptional({ description: "Optional location membership to assign" })
  @IsOptional()
  @IsUUID()
  membershipLocationId?: string;
}
