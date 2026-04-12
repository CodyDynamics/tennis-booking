import { ApiProperty } from "@nestjs/swagger";
import { IsIn } from "class-validator";

export class PatchCoachSessionDto {
  @ApiProperty({ enum: ["scheduled", "completed", "cancelled"] })
  @IsIn(["scheduled", "completed", "cancelled"])
  status: "scheduled" | "completed" | "cancelled";
}
