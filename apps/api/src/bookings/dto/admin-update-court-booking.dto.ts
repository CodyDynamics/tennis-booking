import { ApiPropertyOptional } from "@nestjs/swagger";
import {
  IsBoolean,
  IsDateString,
  IsIn,
  IsOptional,
  IsString,
  Matches,
  IsUUID,
} from "class-validator";

export class AdminUpdateCourtBookingDto {
  @ApiPropertyOptional({ enum: ["pending", "confirmed", "cancelled", "completed"] })
  @IsOptional()
  @IsIn(["pending", "confirmed", "cancelled", "completed"])
  bookingStatus?: string;

  @ApiPropertyOptional({ enum: ["unpaid", "paid", "refunded"] })
  @IsOptional()
  @IsIn(["unpaid", "paid", "refunded"])
  paymentStatus?: string;

  @ApiPropertyOptional({ description: "Optional admin note (stored in-memory in UI only for now)" })
  @IsOptional()
  @IsString()
  note?: string;

  /** When any schedule field is sent, all three must be provided (admin calendar reschedule). */
  @ApiPropertyOptional({ example: "2026-04-06" })
  @IsOptional()
  @IsDateString()
  bookingDate?: string;

  @ApiPropertyOptional({ example: "09:00" })
  @IsOptional()
  @IsString()
  @Matches(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, {
    message: "startTime must be HH:mm",
  })
  startTime?: string;

  @ApiPropertyOptional({ example: "10:00" })
  @IsOptional()
  @IsString()
  @Matches(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, {
    message: "endTime must be HH:mm",
  })
  endTime?: string;

  @ApiPropertyOptional({
    description:
      "Assign booking to a coach profile (coach.id). Set null/empty to unassign.",
    nullable: true,
  })
  @IsOptional()
  @IsUUID()
  coachId?: string | null;

  @ApiPropertyOptional({
    description:
      "super_admin only: when true during reschedule, allows overlapping an existing booking on the same court.",
  })
  @IsOptional()
  @IsBoolean()
  allowOverlap?: boolean;
}

