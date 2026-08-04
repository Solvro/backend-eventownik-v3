import { IsOptional, IsString } from "class-validator";

import { ApiPropertyOptional } from "@nestjs/swagger";

export class DuplicateEmailDto {
  @ApiPropertyOptional({
    description:
      "Optional name for the duplicated email template. If omitted, the original name suffixed with ' - copy' is used.",
  })
  @IsOptional()
  @IsString()
  name?: string;
}
