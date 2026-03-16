import { IsInt, IsOptional, IsString, IsUUID } from "class-validator";

import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";

export class CreateBlockDto {
  @ApiPropertyOptional({ example: 100 })
  @IsOptional()
  @IsInt()
  capacity?: number;

  @ApiPropertyOptional({ example: 1 })
  @IsOptional()
  @IsInt()
  order?: number;

  @ApiProperty({ example: "Name of the block" })
  @IsString()
  name: string;

  @ApiPropertyOptional({ example: "Description of the block" })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({ example: "3d2f558c-df42-477d-bb2b-674fce2e886a" })
  @IsUUID()
  parentUuid: string;
}
