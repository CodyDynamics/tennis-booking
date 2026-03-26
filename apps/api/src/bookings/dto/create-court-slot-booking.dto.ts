import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import {
  IsDateString,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Min,
} from "class-validator";
import { Type } from "class-transformer";

/**
 * New booking flow: user picks a slot, backend randomly assigns a court.
 * No courtId in request — system chooses.
 */
export class CreateCourtSlotBookingDto {
  @ApiProperty({ description: "Location UUID" })
  @IsUUID()
  locationId: string;

  @ApiProperty({ enum: ["tennis", "pickleball", "ball-machine"] })
  @IsIn(["tennis", "pickleball", "ball-machine"])
  sport: string;

  @ApiProperty({ enum: ["indoor", "outdoor"] })
  @IsIn(["indoor", "outdoor"])
  courtType: string;

  @ApiProperty({ example: "2026-03-26" })
  @IsDateString()
  bookingDate: string;

  @ApiProperty({ example: "08:00" })
  @IsString()
  @Matches(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, { message: "startTime must be HH:mm" })
  startTime: string;

  @ApiProperty({ example: "09:00" })
  @IsString()
  @Matches(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, { message: "endTime must be HH:mm" })
  endTime: string;

  @ApiProperty({ example: 60 })
  @Type(() => Number)
  @IsInt()
  @Min(15)
  durationMinutes: number;

  @ApiPropertyOptional({ description: "Coach UUID (optional, book with coach)" })
  @IsOptional()
  @IsUUID()
  coachId?: string;
}
