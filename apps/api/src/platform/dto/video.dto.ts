import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsOptional, IsString, IsUUID, MaxLength } from "class-validator";

export class PresignVideoDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(255)
  filename?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(128)
  contentType?: string;

  @ApiProperty()
  @IsUUID()
  playerUserId: string;
}

export class RegisterTrainingVideoDto {
  @ApiProperty()
  @IsUUID()
  playerUserId: string;

  @ApiProperty()
  @IsString()
  @MaxLength(512)
  storageKey: string;
}
