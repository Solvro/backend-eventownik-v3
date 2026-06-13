import { Exclude } from "class-transformer";

import { ApiHideProperty, ApiProperty } from "@nestjs/swagger";

import {
  OrganizerType,
  Admin as PrismaAdmin,
} from "../../generated/prisma/client";

export class Admin implements PrismaAdmin {
  @ApiProperty()
  uuid!: string;

  @ApiProperty()
  firstName!: string;

  @ApiProperty()
  lastName!: string;

  @ApiProperty()
  email!: string;

  @ApiHideProperty()
  @Exclude()
  password!: string;

  @ApiProperty()
  type!: OrganizerType;

  @ApiProperty()
  active!: boolean;

  @ApiProperty()
  createdAt!: Date;

  @ApiProperty()
  updatedAt!: Date;
}
