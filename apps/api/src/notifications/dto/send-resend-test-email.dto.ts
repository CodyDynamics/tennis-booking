import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsIn, IsOptional, IsString } from "class-validator";
import { ResendTestScenario } from "../mail-sender.service";

export class SendResendTestEmailDto {
  @ApiProperty({
    enum: ["delivered", "bounced", "complained", "suppressed"],
    example: "delivered",
  })
  @IsIn(["delivered", "bounced", "complained", "suppressed"])
  scenario: ResendTestScenario;

  @ApiPropertyOptional({
    description:
      "Optional label for resend.dev address. Ignored for suppressed scenario.",
    example: "signup-flow",
  })
  @IsOptional()
  @IsString()
  label?: string;

  @ApiPropertyOptional({ example: "Smoke test from local" })
  @IsOptional()
  @IsString()
  subject?: string;
}
