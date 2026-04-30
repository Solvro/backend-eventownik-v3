import { IsOptional, IsString, MaxLength } from "class-validator";
import { PageOptionsDto } from "src/common/dto/page-options.dto";

import { ApiPropertyOptional } from "@nestjs/swagger";

export class ParticipantListingDto extends PageOptionsDto {
  @ApiPropertyOptional({
    description:
      "Comma separated attribute UUIDs to force include in the response",
    example: "uuid-1,uuid-2",
  })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  readonly bonusAttributes?: string;

  // Since nestjs handles object query params slightly differently,
  // we can expect it to be parsed if it's encoded or we treat it as an object
  @ApiPropertyOptional({
    description:
      "JSON string or object of filters for attributes. Format: { 'attributeUuid': 'value' }",
    example: '{"550e8400-e29b-41d4-a716-446655440000": "Some Value"}',
  })
  @IsOptional()
  readonly filters?: unknown;
}
