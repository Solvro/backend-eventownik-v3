import {
  ArrayUnique,
  IsArray,
  IsEnum,
  IsOptional,
  IsUUID,
  ValidateIf,
} from "class-validator";
import { TicketMode } from "src/generated/prisma/enums";

import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";

export class CreateTicketDto {
  @ApiProperty({ enum: TicketMode, example: TicketMode.EVENT })
  @IsEnum(TicketMode)
  mode: TicketMode;

  @ApiPropertyOptional({
    description: "UUID of the block attribute, required for BLOCK tickets",
    example: "3d2f558c-df42-477d-bb2b-674fce2e886a",
  })
  @ValidateIf((o: CreateTicketDto) => o.mode === TicketMode.BLOCK)
  @IsUUID()
  attributeUuid?: string;

  @ApiPropertyOptional({
    description: "UUIDs of the attributes shown to the scanning staff",
    type: String,
    isArray: true,
  })
  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @IsUUID("all", { each: true })
  shownAttributeUuids?: string[];
}
