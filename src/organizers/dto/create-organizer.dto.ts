import { IsUUID } from "class-validator";

import { ApiProperty } from "@nestjs/swagger";

export class CreateOrganizerDto {
  @ApiProperty()
  @IsUUID()
  permissionUuid: string;

  @ApiProperty()
  @IsUUID()
  adminUuid: string;
}
