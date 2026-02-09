import { OrganizerType } from "src/generated/prisma/enums";

import { ApiProperty } from "@nestjs/swagger";

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
}
