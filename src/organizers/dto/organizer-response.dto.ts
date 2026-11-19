import { OrganizerType, PermissionType } from "src/generated/prisma/enums";

import { ApiProperty } from "@nestjs/swagger";

export class OrganizerPermissionResponseDto {
  @ApiProperty()
  uuid: string;

  @ApiProperty()
  eventUuid: string;

  @ApiProperty()
  adminUuid: string;

  @ApiProperty({ enum: PermissionType })
  permission: PermissionType;
}

export class OrganizerResponseDto {
  @ApiProperty()
  uuid: string;

  @ApiProperty()
  firstName: string;

  @ApiProperty()
  lastName: string;

  @ApiProperty()
  email: string;

  @ApiProperty({ enum: OrganizerType })
  type: OrganizerType;

  @ApiProperty()
  active: boolean;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;

  @ApiProperty({ type: [OrganizerPermissionResponseDto], isArray: true })
  permissions: OrganizerPermissionResponseDto[];
}
