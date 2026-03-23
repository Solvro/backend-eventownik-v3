import { IsOptional, IsString } from "class-validator";
import { PageOptionsDto } from "src/common/dto/page-options.dto";

import { ApiPropertyOptional } from "@nestjs/swagger";

export class ParticipantListingDto extends PageOptionsDto {
  @ApiPropertyOptional({
    description: "Comma separated attribute UUIDs to force include",
  })
  @IsOptional()
  @IsString()
  readonly bonus_attributes?: string;

  // Since nestjs handles object query params slightly differently,
  // we can expect it to be parsed if it's encoded or we treat it as an object
  @ApiPropertyOptional({
    description: "JSON string or object of filters for attributes",
  })
  @IsOptional()
  readonly filters?: unknown;
}
