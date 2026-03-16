import { ApiProperty } from "@nestjs/swagger";
import { IsArray, IsString } from "class-validator";

export class UpdateRolePermissionsDto {
  @ApiProperty({
    example: ["courts:view", "courts:create", "users:view"],
    description: "List of permission codes",
  })
  @IsArray()
  @IsString({ each: true })
  permissions: string[];
}
