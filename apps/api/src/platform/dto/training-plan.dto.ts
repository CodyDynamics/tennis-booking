import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { Type } from "class-transformer";
import {
  ArrayMinSize,
  IsArray,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  ValidateNested,
} from "class-validator";

export class TrainingPlanItemInputDto {
  @ApiProperty()
  @IsString()
  @MaxLength(2000)
  title: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  sortOrder?: number;

  @ApiPropertyOptional({ description: "YYYY-MM-DD" })
  @IsOptional()
  @IsString()
  dueDate?: string | null;
}

export class CreateTrainingPlanDto {
  @ApiProperty()
  @IsUUID()
  playerUserId: string;

  @ApiProperty()
  @IsString()
  @MaxLength(255)
  title: string;

  @ApiProperty({ type: [TrainingPlanItemInputDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => TrainingPlanItemInputDto)
  items: TrainingPlanItemInputDto[];
}
