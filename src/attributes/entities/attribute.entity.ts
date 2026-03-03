import {
  AttributeType,
  Attribute as PrismaAttribute,
} from "src/generated/prisma/client";

import { ApiProperty } from "@nestjs/swagger";

export class Attribute implements PrismaAttribute {
  @ApiProperty()
  uuid: string;

  @ApiProperty()
  name: string;

  @ApiProperty()
  eventUuid: string;

  @ApiProperty()
  type: AttributeType;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;

  @ApiProperty()
  showInList: boolean;

  @ApiProperty()
  order: number;

  @ApiProperty({ isArray: true, type: String })
  options: string[];
}
