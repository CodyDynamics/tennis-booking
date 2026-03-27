import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import {
  IsDateString,
  IsIn,
  IsInt,
  IsOptional,
  IsUUID,
  Min,
} from "class-validator";
import { Type } from "class-transformer";

export class CourtWizardWindowsQueryDto {
  @ApiProperty()
  @IsUUID()
  locationId: string;

  @ApiProperty({ enum: ["tennis", "pickleball", "ball-machine"] })
  @IsIn(["tennis", "pickleball", "ball-machine"])
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

/** New flow: no windowId — backend aggregates all windows automatically. */
export class CourtSlotQueryDto extends CourtWizardWindowsQueryDto {
  @ApiProperty({ example: "2026-03-26" })
  @IsDateString()
  bookingDate: string;

  @ApiProperty({ example: 60, description: "Duration in minutes: 30 | 60 | 90" })
  @Type(() => Number)
  @IsInt()
  @Min(15)
  durationMinutes: number;

  @ApiPropertyOptional({
    description:
      "When rescheduling, exclude this booking from busy counts so the current slot shows as available",
  })
  @IsOptional()
  @IsUUID()
  excludeBookingId?: string;
}
