import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import {
  IsUUID,
  IsDateString,
  IsOptional,
  IsString,
  Matches,
  Min,
  IsInt,
} from "class-validator";

export class CreateCourtBookingDto {
  @ApiProperty({ description: "Court UUID" })
  @IsUUID()
  courtId: string;

  @ApiProperty({ example: "2024-12-01", description: "Booking date (YYYY-MM-DD)" })
  @IsDateString()
  bookingDate: string;

  @ApiProperty({ example: "08:00", description: "Start time (HH:mm)" })
  @IsString()
  @Matches(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, {
    message: "startTime must be HH:mm",
  })
  startTime: string;

  @ApiProperty({ example: "09:00", description: "End time (HH:mm)" })
  @IsString()
  @Matches(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, {
    message: "endTime must be HH:mm",
  })
  endTime: string;

  @ApiPropertyOptional({ description: "Coach UUID (optional, book with coach)" })
  @IsOptional()
  @IsUUID()
  coachId?: string;

  @ApiPropertyOptional({ minimum: 15, description: "Duration minutes (default: end - start)" })
  @IsOptional()
  @IsInt()
  @Min(15)
  durationMinutes?: number;
}
