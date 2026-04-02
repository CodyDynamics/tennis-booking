import { ApiProperty } from "@nestjs/swagger";

/** Per-court booking window row for admin Court Time Slot UI */
export class CourtBookingWindowAdminDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  courtId: string;

  @ApiProperty()
  courtName: string;

  @ApiProperty()
  locationId: string;

  @ApiProperty()
  locationName: string;

  /** Legacy DB column; use `courtSports` for display (from Court Management). */
  @ApiProperty({ required: false, description: "Internal / legacy; prefer courtSports" })
  sport: string;

  /** Activities this court supports — same as Court Management `sports`. */
  @ApiProperty({ type: [String] })
  courtSports: string[];

  @ApiProperty()
  courtType: string;

  @ApiProperty({ example: "08:00" })
  windowStartTime: string;

  @ApiProperty({ example: "11:00" })
  windowEndTime: string;

  @ApiProperty()
  isActive: boolean;

  @ApiProperty()
  pricePerHour: number;

  @ApiProperty()
  courtStatus: string;

  @ApiProperty({ required: false, nullable: true })
  description: string | null;
}
