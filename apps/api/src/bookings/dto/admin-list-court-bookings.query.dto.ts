import { ApiPropertyOptional } from "@nestjs/swagger";
import { IsIn, IsOptional, IsString, Matches } from "class-validator";

export class AdminListCourtBookingsQueryDto {
  @ApiPropertyOptional({ description: "Filter by locationId" })
  @IsOptional()
  @IsString()
  locationId?: string;

  @ApiPropertyOptional({ description: "Search by user email/name or court name" })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({ description: "From date (YYYY-MM-DD)" })
  @IsOptional()
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: "from must be YYYY-MM-DD" })
  from?: string;

  @ApiPropertyOptional({ description: "To date (YYYY-MM-DD)" })
  @IsOptional()
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: "to must be YYYY-MM-DD" })
  to?: string;

  @ApiPropertyOptional({ description: "Booking status", enum: ["pending", "confirmed", "cancelled", "completed"] })
  @IsOptional()
  @IsIn(["pending", "confirmed", "cancelled", "completed"])
  status?: string;

  @ApiPropertyOptional({ description: "Payment status", enum: ["unpaid", "paid", "refunded"] })
  @IsOptional()
  @IsIn(["unpaid", "paid", "refunded"])
  paymentStatus?: string;
}

