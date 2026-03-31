import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import {
  IsString,
  IsOptional,
  IsNumber,
  IsIn,
  Min,
  Matches,
  IsArray,
  ArrayMinSize,
} from "class-validator";

export class CreateCourtDto {
  @ApiProperty({ description: "Location UUID" })
  @IsString()
  locationId: string;

  @ApiPropertyOptional({ description: "Area UUID (under location)" })
  @IsOptional()
  @IsString()
  areaId?: string;

  @ApiProperty({ example: "Court 1", description: "Court name" })
  @IsString()
  name: string;

  @ApiPropertyOptional({
    type: [String],
    example: ["outdoor", "indoor"],
    description: "Indoor and/or outdoor; at least one required when creating",
  })
  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @IsIn(["indoor", "outdoor"], { each: true })
  courtTypes?: string[];

  @ApiPropertyOptional({
    enum: ["indoor", "outdoor"],
    default: "outdoor",
    description: "Deprecated: use courtTypes",
  })
  @IsOptional()
  @IsIn(["indoor", "outdoor"])
  type?: string;

  /**
   * Sports this court supports (shared scheduling). Prefer over legacy `sport`.
   */
  @ApiPropertyOptional({
    type: [String],
    example: ["tennis", "pickleball"],
  })
  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @IsIn(["tennis", "pickleball", "ball-machine"], { each: true })
  sports?: string[];

  @ApiPropertyOptional({
    enum: ["tennis", "pickleball", "ball-machine"],
    description: "Deprecated: single sport; use `sports` for multiple",
  })
  @IsOptional()
  @IsIn(["tennis", "pickleball", "ball-machine"])
  sport?: string;

  @ApiPropertyOptional({
    example: 20,
    minimum: 0,
    description: "Public (non-member) price per hour",
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  pricePerHourPublic?: number;

  @ApiPropertyOptional({
    example: 15,
    minimum: 0,
    description:
      "Optional member hourly rate for this court (overrides location % discount)",
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  pricePerHourMember?: number | null;

  @ApiPropertyOptional({
    example: 20,
    minimum: 0,
    description: "Deprecated: same as pricePerHourPublic",
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  pricePerHour?: number;

  @ApiPropertyOptional({ description: "Court description" })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ description: "Main image URL" })
  @IsOptional()
  @IsString()
  imageUrl?: string;

  @ApiPropertyOptional({ description: "JSON array of image URLs for gallery" })
  @IsOptional()
  @IsString()
  imageGallery?: string;

  @ApiPropertyOptional({ description: "Google Maps embed URL" })
  @IsOptional()
  @IsString()
  mapEmbedUrl?: string;

  @ApiPropertyOptional({ enum: ["active", "maintenance"], default: "active" })
  @IsOptional()
  @IsIn(["active", "maintenance"])
  status?: string;

  @ApiPropertyOptional({
    example: "08:00",
    description:
      "Optional per-court booking window start time (HH:mm). If set, end time is required.",
  })
  @IsOptional()
  @IsString()
  @Matches(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, {
    message: "windowStartTime must be HH:mm",
  })
  windowStartTime?: string;

  @ApiPropertyOptional({
    example: "11:00",
    description:
      "Optional per-court booking window end time (HH:mm). If set, start time is required.",
  })
  @IsOptional()
  @IsString()
  @Matches(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, {
    message: "windowEndTime must be HH:mm",
  })
  windowEndTime?: string;
}
