import { IsUUID, IsDateString, IsOptional } from "class-validator";

export class CheckCourtAvailabilityDto {
  @IsUUID()
  courtId: string;

  @IsDateString()
  date: string; // YYYY-MM-DD

  @IsOptional()
  @IsDateString()
  startTime?: string;

  @IsOptional()
  @IsDateString()
  endTime?: string;
}
