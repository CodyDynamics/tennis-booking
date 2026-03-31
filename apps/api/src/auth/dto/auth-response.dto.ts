import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";

export class AuthResponseDto {
  @ApiProperty({ description: "JWT access token" })
  accessToken: string;

  @ApiPropertyOptional({ description: "Refresh token" })
  refreshToken?: string;

  @ApiProperty({ description: "User id" })
  user: {
    id: string;
    email: string;
    fullName: string;
    role?: string;
    mustChangePasswordOnFirstLogin?: boolean;
  };
}
