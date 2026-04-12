import { ApiProperty } from "@nestjs/swagger";
import { IsObject } from "class-validator";

export class CreateMetricSnapshotDto {
  @ApiProperty({ type: "object", additionalProperties: { type: "number" } })
  @IsObject()
  scores: Record<string, number>;
}
