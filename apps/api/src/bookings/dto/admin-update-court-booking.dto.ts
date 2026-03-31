import { ApiPropertyOptional } from "@nestjs/swagger";
import { IsIn, IsOptional, IsString } from "class-validator";

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
}

