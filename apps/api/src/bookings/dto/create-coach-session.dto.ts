import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import {
  IsUUID,
  IsDateString,
  IsOptional,
  IsString,
  Matches,
  Min,
  IsInt,
  IsIn,
} from "class-validator";

export class CreateCoachSessionDto {
  @ApiProperty({ description: "Coach UUID" })
  @IsUUID()
  coachId: string;

  @ApiProperty({ example: "2024-12-01", description: "Session date (YYYY-MM-DD)" })
  @IsDateString()
  sessionDate: string;

  @ApiProperty({ example: "09:00", description: "Start time (HH:mm)" })
  @IsString()
  @Matches(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, {
    message: "startTime must be HH:mm",
  })
  startTime: string;

  @ApiProperty({ example: 60, minimum: 15, description: "Duration in minutes" })
  @IsInt()
  @Min(15)
  durationMinutes: number;

  @ApiPropertyOptional({ description: "Court UUID (optional, book coach with court)" })
  @IsOptional()
  @IsUUID()
  courtId?: string;

  @ApiPropertyOptional({ enum: ["private", "group"], default: "private" })
  @IsOptional()
  @IsIn(["private", "group"])
  sessionType?: string;
}
