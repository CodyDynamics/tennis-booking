import { ApiProperty } from "@nestjs/swagger";
import { IsUUID } from "class-validator";

export class CreateParentLinkDto {
  @ApiProperty()
  @IsUUID()
  childUserId: string;
}
