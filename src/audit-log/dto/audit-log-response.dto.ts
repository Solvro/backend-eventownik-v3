import { AttributeType, LogTrigger } from "src/generated/prisma/enums";

import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";

export class AuditLogActorDto {
  @ApiProperty({ enum: LogTrigger })
  type: LogTrigger;

  @ApiProperty({ type: String, nullable: true })
  uuid: string | null;

  @ApiProperty({
    type: String,
    nullable: true,
    description: "Actor name at the time of the action",
  })
  name: string | null;
}

export class AuditLogEntityDto {
  @ApiProperty({ example: "participant" })
  type: string;

  @ApiProperty({ type: String, nullable: true })
  uuid: string | null;

  @ApiProperty({
    type: String,
    nullable: true,
    description: "Human readable label at the time of the action",
  })
  label: string | null;
}

export class AuditLogAttributeDto {
  @ApiProperty()
  uuid: string;

  @ApiProperty()
  name: string;

  @ApiProperty({ enum: AttributeType })
  type: AttributeType;
}

export class AuditLogChangeDto {
  @ApiProperty({
    enum: ["value", "list", "blocks", "file", "changed"],
    description:
      "value: from/to. list: added/removed values. blocks: added/removed blocks. file: from/to file names. changed: the field was modified, its value is not recorded",
  })
  kind: "value" | "list" | "blocks" | "file" | "changed";

  @ApiProperty({ description: "Field or attribute name" })
  field: string;

  @ApiPropertyOptional({
    type: AuditLogAttributeDto,
    description: "Present when the change is a participant attribute value",
  })
  attribute?: AuditLogAttributeDto;

  @ApiPropertyOptional({ description: "Previous value (kinds value, file)" })
  from?: unknown;

  @ApiPropertyOptional({ description: "New value (kinds value, file)" })
  to?: unknown;

  @ApiPropertyOptional({
    type: [Object],
    isArray: true,
    description: "Kinds list, blocks",
  })
  added?: unknown[];

  @ApiPropertyOptional({
    type: [Object],
    isArray: true,
    description: "Kinds list, blocks",
  })
  removed?: unknown[];
}

export class AuditLogResponseDto {
  @ApiProperty()
  uuid: string;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty({ example: "participant.deleted" })
  action: string;

  @ApiProperty({ type: AuditLogActorDto })
  actor: AuditLogActorDto;

  @ApiProperty({ type: AuditLogEntityDto })
  entity: AuditLogEntityDto;

  @ApiProperty({ type: [AuditLogChangeDto], isArray: true })
  changes: AuditLogChangeDto[];

  @ApiProperty({
    type: String,
    nullable: true,
    description: "Shared by all entries produced by one bulk operation",
  })
  correlationId: string | null;
}
