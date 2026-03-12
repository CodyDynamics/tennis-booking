import {
  IsEmail,
  IsString,
  MinLength,
  IsOptional,
  IsUUID,
} from "class-validator";

export class RegisterDto {
  @IsEmail()
  email: string;

  @IsString()
  @MinLength(8)
  password: string;

  @IsString()
  fullName: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsUUID()
  organizationId?: string;

  @IsOptional()
  @IsUUID()
  branchId?: string;

  @IsString()
  roleId: string; // UUID of role
}
