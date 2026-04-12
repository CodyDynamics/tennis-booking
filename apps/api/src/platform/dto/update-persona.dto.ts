import { ApiPropertyOptional } from "@nestjs/swagger";
import { IsDateString, IsIn, IsOptional } from "class-validator";

export class UpdatePersonaDto {
  @ApiPropertyOptional({ enum: ["coach", "player", "parent"] })
  @IsOptional()
  @IsIn(["coach", "player", "parent"])
  appPersona?: "coach" | "player" | "parent" | null;

  @ApiPropertyOptional({ description: "ISO-8601 timestamp when onboarding finished" })
  @IsOptional()
  @IsDateString()
  onboardingCompletedAt?: string | null;
}
