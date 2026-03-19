import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsString, IsOptional, IsNumber, IsIn, Min } from "class-validator";

export class CreateCourtDto {
  @ApiProperty({ description: "Location UUID" })
  @IsString()
  locationId: string;

  @ApiProperty({ example: "Court 1", description: "Court name" })
  @IsString()
  name: string;

  @ApiPropertyOptional({ enum: ["indoor", "outdoor"], default: "outdoor" })
  @IsOptional()
  @IsIn(["indoor", "outdoor"])
  type?: string;

  @ApiPropertyOptional({ enum: ["tennis", "pickleball"], default: "tennis" })
  @IsOptional()
  @IsIn(["tennis", "pickleball"])
  sport?: string;

  @ApiPropertyOptional({ example: 200000, minimum: 0, description: "Price per hour" })
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
  imageGallery?: string;

  @ApiPropertyOptional({ description: "Google Maps embed URL" })
  @IsOptional()
  @IsString()
  mapEmbedUrl?: string;

  @ApiPropertyOptional({ enum: ["active", "maintenance"], default: "active" })
  @IsOptional()
  @IsIn(["active", "maintenance"])
  status?: string;
}
