import { IsOptional, IsUUID } from "class-validator";

import { ApiPropertyOptional } from "@nestjs/swagger";

import { CreateAttributeDto } from "./create-attribute.dto";

export class BulkUpdateAttributeDto extends CreateAttributeDto {
  @ApiPropertyOptional({
    description:
      "If provided, updates an existing attribute; otherwise creates.",
    example: "123e4567-e89b-12d3-a456-426614174000",
  })
  @IsOptional()
  @IsUUID()
  uuid?: string;
}
