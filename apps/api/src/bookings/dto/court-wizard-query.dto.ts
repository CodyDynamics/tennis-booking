import { ApiProperty } from "@nestjs/swagger";
import {
  IsDateString,
  IsIn,
  IsInt,
  IsUUID,
  Min,
} from "class-validator";
import { Type } from "class-transformer";

export class CourtWizardWindowsQueryDto {
  @ApiProperty()
  @IsUUID()
  locationId: string;

  @ApiProperty({ enum: ["tennis", "pickleball"] })
  @IsIn(["tennis", "pickleball"])
  sport: string;

  @ApiProperty({ enum: ["indoor", "outdoor"] })
  @IsIn(["indoor", "outdoor"])
  courtType: string;
}

export class CourtWizardAvailabilityQueryDto extends CourtWizardWindowsQueryDto {
  @ApiProperty({ example: "2026-03-22" })
  @IsDateString()
  bookingDate: string;

  @ApiProperty()
  @IsUUID()
  windowId: string;

  @ApiProperty({ example: 60 })
  @Type(() => Number)
  @IsInt()
  @Min(15)
  durationMinutes: number;
}
