import { PartialType, OmitType } from "@nestjs/swagger";
import { CreateUserDto } from "./create-user.dto";
import { UserAccountType } from "../entities/user-account-type.enum";
import {
  IsOptional,
  IsString,
  IsIn,
  MinLength,
  IsUUID,
  ValidateIf,
  Matches,
} from "class-validator";
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

  @ApiPropertyOptional({ enum: UserAccountType })
  @IsOptional()
  @IsIn([
    UserAccountType.SYSTEM,
    UserAccountType.NORMAL,
    UserAccountType.MEMBERSHIP,
  ])
  accountType?: UserAccountType;

  @ApiPropertyOptional({ description: "Membership period start (YYYY-MM-DD)" })
  @IsOptional()
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: "membershipJoinDate must be YYYY-MM-DD" })
  membershipJoinDate?: string | null;

  @ApiPropertyOptional({ description: "Membership period end (YYYY-MM-DD)" })
  @IsOptional()
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: "membershipEndDate must be YYYY-MM-DD" })
  membershipEndDate?: string | null;
}
