import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsIn, IsOptional, IsString, IsUUID, MaxLength } from "class-validator";

export class CreateFeedbackNoteDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  coachSessionId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  courtBookingId?: string;

  @ApiProperty()
  @IsString()
  @MaxLength(8000)
  body: string;

  @ApiPropertyOptional({ enum: ["coach_only", "coach_player", "family"] })
  @IsOptional()
  @IsIn(["coach_only", "coach_player", "family"])
  visibility?: string;
}
