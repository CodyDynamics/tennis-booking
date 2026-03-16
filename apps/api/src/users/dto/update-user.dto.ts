import { PartialType, OmitType } from "@nestjs/swagger";
import { CreateUserDto } from "./create-user.dto";
import { IsOptional, IsString, IsIn, MinLength } from "class-validator";
import { ApiPropertyOptional } from "@nestjs/swagger";

export class UpdateUserDto extends PartialType(
  OmitType(CreateUserDto, ["password"] as const),
) {
  @ApiPropertyOptional({ enum: ["active", "inactive"] })
  @IsOptional()
  @IsString()
  @IsIn(["active", "inactive"])
  status?: string;

  @ApiPropertyOptional({ minLength: 8, description: "New password (only if changing)" })
  @IsOptional()
  @IsString()
  @MinLength(8)
  password?: string;
}
