import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsString, IsOptional, IsUUID } from "class-validator";

export class CreateBranchDto {
  @ApiPropertyOptional({ description: "Organization UUID" })
  @IsOptional()
  @IsUUID()
  organizationId?: string;

  @ApiProperty({ example: "Downtown Branch", description: "Branch name" })
  @IsString()
  name: string;

  @ApiPropertyOptional({ example: "123 Main St", description: "Branch address" })
  @IsOptional()
  @IsString()
  address?: string;

  @ApiPropertyOptional({ example: "+84123456789", description: "Contact phone" })
  @IsOptional()
  @IsString()
  phone?: string;
}
