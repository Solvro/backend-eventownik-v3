import { Transform, Type } from "class-transformer";
import {
  IsArray,
  IsDate,
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
} from "class-validator";
import { PageOptionsDto } from "src/common/dto/page-options.dto";
import { LogTrigger } from "src/generated/prisma/enums";

import { ApiPropertyOptional } from "@nestjs/swagger";

export class AuditLogListingDto extends PageOptionsDto {
  @ApiPropertyOptional({
    enum: LogTrigger,
    description: "Filter by actor type",
  })
  @IsOptional()
  @IsEnum(LogTrigger)
  readonly actorType?: LogTrigger;

  @ApiPropertyOptional({ description: "Filter by actor UUID" })
  @IsOptional()
  @IsUUID()
  readonly actorUuid?: string;

  @ApiPropertyOptional({
    type: [String],
    isArray: true,
    description:
      "Filter by action codes. Repeat the parameter or pass a comma separated list",
    example: "participant.deleted,participant.attribute_changed",
  })
  @IsOptional()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === "string" ? value.split(",") : value,
  )
  @IsArray()
  @IsString({ each: true })
  readonly action?: string[];

  @ApiPropertyOptional({
    description: "Filter by entity type",
    example: "participant",
  })
  @IsOptional()
  @IsString()
  readonly entityType?: string;

  @ApiPropertyOptional({ description: "Filter by entity UUID" })
  @IsOptional()
  @IsUUID()
  readonly entityUuid?: string;

  @ApiPropertyOptional({
    description: "Only entries created at or after this date",
  })
  @IsOptional()
  @Type(() => Date)
  @IsDate()
  readonly from?: Date;

  @ApiPropertyOptional({
    description: "Only entries created at or before this date",
  })
  @IsOptional()
  @Type(() => Date)
  @IsDate()
  readonly to?: Date;
}
