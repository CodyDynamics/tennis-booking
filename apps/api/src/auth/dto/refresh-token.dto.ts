import { ApiProperty } from "@nestjs/swagger";
import { IsString } from "class-validator";

export class RefreshTokenDto {
  @ApiProperty({ description: "Refresh token to get new access token" })
  @IsString()
  refreshToken: string;
}
