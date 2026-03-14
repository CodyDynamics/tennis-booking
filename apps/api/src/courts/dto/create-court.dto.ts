import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsString, IsOptional, IsNumber, IsIn, Min } from "class-validator";

export class CreateCourtDto {
  @ApiProperty({ description: "Branch UUID" })
  @IsString()
  branchId: string;

  @ApiProperty({ example: "Court 1", description: "Court name" })
  @IsString()
  name: string;

  @ApiPropertyOptional({ enum: ["indoor", "outdoor"], default: "outdoor" })
  @IsOptional()
  @IsIn(["indoor", "outdoor"])
  type?: string;

  @ApiPropertyOptional({ example: 200000, minimum: 0, description: "Price per hour" })
  @IsOptional()
  @IsNumber()
  @Min(0)
  pricePerHour?: number;

  @ApiPropertyOptional({ description: "Court description" })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ enum: ["active", "maintenance"], default: "active" })
  @IsOptional()
  @IsIn(["active", "maintenance"])
  status?: string;
}
