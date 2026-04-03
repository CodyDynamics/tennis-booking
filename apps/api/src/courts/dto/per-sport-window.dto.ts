import { ApiProperty } from "@nestjs/swagger";
import { IsIn, IsString, Matches } from "class-validator";

export class PerSportWindowDto {
  @ApiProperty({ example: "tennis" })
  @IsString()
  @IsIn(["tennis", "pickleball", "ball-machine"])
  sport: string;

  @ApiProperty({ example: "08:00" })
  @IsString()
  @Matches(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, {
    message: "windowStartTime must be HH:mm",
  })
  windowStartTime: string;

  @ApiProperty({ example: "16:00" })
  @IsString()
  @Matches(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, {
    message: "windowEndTime must be HH:mm",
  })
  windowEndTime: string;
}
