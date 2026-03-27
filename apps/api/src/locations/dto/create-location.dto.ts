import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import {
  IsString,
  IsOptional,
  IsUUID,
  IsInt,
  Min,
  Max,
  IsIn,
} from "class-validator";
import {
  LocationVisibility,
  MemberCourtPriceBasis,
} from "../entities/location.enums";
import { LocationKind } from "../entities/location-kind.enum";

export class CreateLocationDto {
  @ApiProperty()
  @IsUUID()
  branchId: string;

  @ApiPropertyOptional({ description: "Parent location UUID (for location child)" })
  @IsOptional()
  @IsUUID()
  parentLocationId?: string;

  @ApiPropertyOptional({ enum: LocationKind, default: LocationKind.CHILD })
  @IsOptional()
  @IsIn([LocationKind.ROOT, LocationKind.CHILD])
  kind?: LocationKind;

  @ApiProperty()
  @IsString()
  name: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  address?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  latitude?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  longitude?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  mapMarkers?: string;

  @ApiPropertyOptional({ example: "America/Chicago" })
  @IsOptional()
  @IsString()
  timezone?: string;

  @ApiPropertyOptional({ enum: LocationVisibility })
  @IsOptional()
  @IsIn([LocationVisibility.PUBLIC, LocationVisibility.PRIVATE])
  visibility?: LocationVisibility;

  @ApiPropertyOptional({ description: "Initiation fee (cents)" })
  @IsOptional()
  @IsInt()
  @Min(0)
  membershipInitiationFeeCents?: number;

  @ApiPropertyOptional({ description: "Monthly fee (cents)" })
  @IsOptional()
  @IsInt()
  @Min(0)
  membershipMonthlyFeeCents?: number;

  @ApiPropertyOptional({ description: "0–100 discount for members" })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(100)
  memberCourtDiscountPercent?: number;

  @ApiPropertyOptional({ enum: MemberCourtPriceBasis })
  @IsOptional()
  @IsIn([
    MemberCourtPriceBasis.DISCOUNT_FROM_PUBLIC,
    MemberCourtPriceBasis.FIXED_MEMBER_RATE,
  ])
  memberCourtPriceBasis?: MemberCourtPriceBasis;

  @ApiPropertyOptional()
  @IsOptional()
  @IsIn(["active", "inactive"])
  status?: string;
}
