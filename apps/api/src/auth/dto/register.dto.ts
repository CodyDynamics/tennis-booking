import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import {
  IsEmail,
  IsString,
  MinLength,
  IsOptional,
  IsUUID,
  IsNotEmpty,
  MaxLength,
  Matches,
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

  @ApiPropertyOptional({ example: "John" })
  @IsOptional()
  @IsString()
  firstName?: string;

  @ApiPropertyOptional({ example: "Doe" })
  @IsOptional()
  @IsString()
  lastName?: string;

  @ApiProperty({
    example: "+15551234567",
    description: "US mobile in E.164 (+1 + 10 digits)",
  })
  @IsString()
  @IsNotEmpty()
  @Matches(/^\+1\d{10}$/, {
    message: "Phone must be a valid US number (+1 and exactly 10 digits)",
  })
  phone: string;

  @ApiProperty({ example: "123 Main St", description: "Street address" })
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  street: string;

  @ApiProperty({ example: "Austin" })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  city: string;

  @ApiProperty({ example: "TX" })
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  state: string;

  @ApiProperty({ example: "78701" })
  @IsString()
  @IsNotEmpty()
  @MaxLength(10)
  zipCode: string;

  @ApiPropertyOptional({ description: "Organization UUID" })
  @IsOptional()
  @IsUUID()
  organizationId?: string;

  @ApiPropertyOptional({ description: "Branch UUID" })
  @IsOptional()
  @IsUUID()
  branchId?: string;
}
