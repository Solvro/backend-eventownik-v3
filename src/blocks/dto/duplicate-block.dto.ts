import { IsOptional, IsString } from "class-validator";

import { ApiPropertyOptional } from "@nestjs/swagger";

export class DuplicateBlockDto {
  @ApiPropertyOptional({
    description:
      "Optional name for the duplicated block. If omitted, the original name suffixed with ' - copy' is used.",
  })
  @IsOptional()
  @IsString()
  name?: string;
}
