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

  @ApiProperty()
  sport: string;

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
