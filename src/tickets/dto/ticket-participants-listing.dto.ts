import { Transform } from "class-transformer";
import {
  IsBoolean,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from "class-validator";
import { PageOptionsDto } from "src/common/dto/page-options.dto";

import { ApiPropertyOptional } from "@nestjs/swagger";

export class TicketParticipantsListingDto extends PageOptionsDto {
  @ApiPropertyOptional({
    description:
      "UUID of the guarded block, required for BLOCK tickets and forbidden for EVENT tickets",
    example: "3d2f558c-df42-477d-bb2b-674fce2e886a",
  })
  @IsOptional()
  @IsUUID()
  readonly blockUuid?: string;

  @ApiPropertyOptional({
    description: "Only participants with (true) or without (false) attendance",
  })
  @IsOptional()
  @Transform(({ value }: { value: unknown }) =>
    value === "true" ? true : value === "false" ? false : value,
  )
  @IsBoolean()
  readonly confirmed?: boolean;

  @ApiPropertyOptional({ description: "Case-insensitive email fragment" })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  readonly search?: string;
}
