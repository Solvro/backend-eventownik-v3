import { ApiProperty } from "@nestjs/swagger";

import {
  EventLinkType,
  EventLink as PrismaEventLink,
} from "../../generated/prisma/client";

export class EventLink implements PrismaEventLink {
  @ApiProperty()
  uuid: string;

  @ApiProperty()
  eventUuid: string;

  @ApiProperty()
  url: string;

  @ApiProperty({ enum: EventLinkType })
  type: EventLinkType;

  @ApiProperty({ nullable: true, required: false })
  label: string | null;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;
}
