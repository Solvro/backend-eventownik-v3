import { IsInt, IsOptional, IsString, IsUUID } from "class-validator";

import { ApiPropertyOptional } from "@nestjs/swagger";

export class CreateBlockDto {
  @ApiPropertyOptional({ example: 100 })
  @IsOptional()
  @IsInt()
  capacity?: number;

  @ApiPropertyOptional({ example: 1 })
  @IsOptional()
  @IsInt()
  order?: number;

  @ApiPropertyOptional({ example: "Name of the block" })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional({ example: "Description of the block" })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ example: "3d2f558c-df42-477d-bb2b-674fce2e886a" })
  @IsOptional()
  @IsUUID()
  parentUuid?: string;
}
