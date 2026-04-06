import { ApiPropertyOptional } from "@nestjs/swagger";
import { IsBoolean, IsOptional, IsUUID } from "class-validator";
import { CreateCourtBookingDto } from "./create-court-booking.dto";

/** Admin calendar only: same body as public create + optional series id for bulk / recurring. */
export class AdminCreateCourtBookingDto extends CreateCourtBookingDto {
  @ApiPropertyOptional({
    description:
      "When set, links this row to a calendar series (multi-date / recurring admin create) for cancel-all.",
  })
  @IsOptional()
  @IsUUID()
  adminCalendarSeriesId?: string;

  @ApiPropertyOptional({
    description:
      "When true, sends the usual single booking confirmation email. Omitted/false sends no email (avoids spam).",
  })
  @IsOptional()
  @IsBoolean()
  sendConfirmationEmail?: boolean;
}
