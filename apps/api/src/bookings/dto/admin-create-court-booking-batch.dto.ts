import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsDateString,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Min,
} from "class-validator";

export class AdminCreateCourtBookingBatchDto {
  @ApiProperty()
  @IsUUID()
  courtId: string;

  @ApiProperty({ type: [String], example: ["2026-04-07", "2026-04-08"] })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(400)
  @IsDateString({}, { each: true })
  bookingDates: string[];

  @ApiProperty({ example: "08:00" })
  @IsString()
  @Matches(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, {
    message: "startTime must be HH:mm",
  })
  startTime: string;

  @ApiProperty({ example: "09:00" })
  @IsString()
  @Matches(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, {
    message: "endTime must be HH:mm",
  })
  endTime: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(15)
  durationMinutes?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  adminCalendarSeriesId?: string;

  @ApiPropertyOptional({
    description:
      "When true, sends one summary email listing every successfully created date. Omitted/false sends no confirmation email.",
  })
  @IsOptional()
  @IsBoolean()
  sendConfirmationEmail?: boolean;
}
