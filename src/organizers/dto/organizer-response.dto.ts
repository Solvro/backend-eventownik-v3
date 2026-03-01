import { OrganizerType } from "src/generated/prisma/enums";

import { ApiProperty } from "@nestjs/swagger";

export class OrganizerPermissionResponseDto {
  @ApiProperty()
  permissionUuid: string;

  @ApiProperty()
  action: string;

  @ApiProperty()
  subject: string;
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
