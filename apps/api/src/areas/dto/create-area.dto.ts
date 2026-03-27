import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsIn, IsOptional, IsString, IsUUID } from "class-validator";
import { LocationVisibility } from "../../locations/entities/location.enums";

export class CreateAreaDto {
  @ApiProperty()
  @IsUUID()
  locationId: string;

  @ApiProperty({ example: "Area 1" })
  @IsString()
  name: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ enum: ["active", "inactive"], default: "active" })
  @IsOptional()
  @IsIn(["active", "inactive"])
  status?: string;

  @ApiPropertyOptional({ enum: ["public", "private"], default: "public" })
  @IsOptional()
  @IsIn([LocationVisibility.PUBLIC, LocationVisibility.PRIVATE])
  visibility?: LocationVisibility;
}
