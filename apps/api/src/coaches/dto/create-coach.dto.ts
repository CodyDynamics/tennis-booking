import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsString, IsOptional, IsNumber, Min } from "class-validator";

export class CreateCoachDto {
  @ApiProperty({ description: "UUID user (role coach)" })
  @IsString()
  userId: string;

  @ApiPropertyOptional({ example: 5, minimum: 0, description: "Years of experience" })
  @IsOptional()
  @IsNumber()
  @Min(0)
  experienceYears?: number;

  @ApiPropertyOptional({ description: "Bio / description" })
  @IsOptional()
  @IsString()
  bio?: string;

  @ApiPropertyOptional({ example: 300000, minimum: 0, description: "Hourly rate" })
  @IsOptional()
  @IsNumber()
  @Min(0)
  hourlyRate?: number;
}
