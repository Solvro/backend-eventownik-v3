import { PermissionType } from "src/generated/prisma/client";

import { ApiProperty } from "@nestjs/swagger";

export class PermissionDto {
  @ApiProperty({ example: "123e4567-e89b-12d3-a456-426614174000" })
  eventId!: string;

  @ApiProperty({
    enum: PermissionType,
    enumName: "PermissionType",
    example: PermissionType.MANAGE_EVENT,
  })
  permission!: PermissionType;
}
