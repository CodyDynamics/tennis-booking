import { IsUUID, IsDateString, IsOptional } from "class-validator";

export class CheckAvailabilityDto {
  @IsUUID()
  courtId: string;

  @IsDateString()
  date: string; // YYYY-MM-DD

  @IsOptional()
  @IsDateString()
  startTime?: string; // HH:mm

  @IsOptional()
  @IsDateString()
  endTime?: string; // HH:mm
}
