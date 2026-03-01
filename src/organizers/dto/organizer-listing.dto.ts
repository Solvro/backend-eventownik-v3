import { Transform } from "class-transformer";
import { IsBoolean, IsOptional } from "class-validator";
import { PageOptionsDto } from "src/common/dto/page-options.dto";

import { ApiPropertyOptional } from "@nestjs/swagger";

export class OrganizerListingDto extends PageOptionsDto {
  @ApiPropertyOptional({ description: "filter by active status" })
  @IsOptional()
  @IsBoolean()
  @Transform(({ value }: { value: string }) =>
    value === "true" ? true : value === "false" ? false : value,
  )
  isActive?: boolean;
}
