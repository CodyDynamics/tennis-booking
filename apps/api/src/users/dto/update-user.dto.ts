import { PartialType, OmitType } from "@nestjs/swagger";
import { CreateUserDto } from "./create-user.dto";
import { IsOptional, IsString, IsIn, MinLength, IsUUID, ValidateIf } from "class-validator";
import { ApiPropertyOptional } from "@nestjs/swagger";

export class UpdateUserDto extends PartialType(
  OmitType(CreateUserDto, ["password", "membershipLocationId"] as const),
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

  @ApiPropertyOptional({
    nullable: true,
    description:
      "Location membership (same as Area→location). Omit to leave unchanged; null to clear.",
  })
  @IsOptional()
  @ValidateIf((o) => o.membershipLocationId !== null && o.membershipLocationId !== undefined)
  @IsUUID()
  membershipLocationId?: string | null;
}
