import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import {
  IsEmail,
  IsString,
  MinLength,
  IsOptional,
  IsUUID,
} from "class-validator";

export class RegisterDto {
  @ApiProperty({ example: "user@example.com", description: "Registration email" })
  @IsEmail()
  email: string;

  @ApiProperty({ example: "password123", minLength: 8, description: "Password (min 8 characters)" })
  @IsString()
  @MinLength(8)
  password: string;

  @ApiProperty({ example: "John Doe", description: "Full name" })
  @IsString()
  fullName: string;

  @ApiPropertyOptional({ example: "0901234567", description: "Phone number" })
  @IsOptional()
  @IsString()
  phone?: string;

  @ApiPropertyOptional({ description: "Organization UUID" })
  @IsOptional()
  @IsUUID()
  organizationId?: string;

  @ApiPropertyOptional({ description: "Branch UUID" })
  @IsOptional()
  @IsUUID()
  branchId?: string;

  @ApiProperty({ description: "Role UUID" })
  @IsString()
  roleId: string;
}
