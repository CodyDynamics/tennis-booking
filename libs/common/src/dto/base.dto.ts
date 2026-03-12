import { IsOptional, IsUUID } from "class-validator";

export class BaseDto {
  @IsOptional()
  @IsUUID()
  organizationId?: string;
}
