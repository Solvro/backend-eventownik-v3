import { ApiProperty } from "@nestjs/swagger";

import { Event as PrismaEvent } from "../../generated/prisma/client";

export class Event implements PrismaEvent {
  @ApiProperty()
  name: string;

  @ApiProperty()
  uuid: string;

  @ApiProperty({ isArray: true, type: String })
  links: string[];

  @ApiProperty({ isArray: true, type: String })
  policyLinks: string[];

  @ApiProperty()
  startDate: Date;

  @ApiProperty()
  endDate: Date;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;

  @ApiProperty()
  slug: string;

  @ApiProperty()
  isPublic: boolean;

  @ApiProperty({ nullable: true, required: false })
  participantsLimit: number | null;

  @ApiProperty({ nullable: true, required: false })
  verifiedAt: Date | null;

  @ApiProperty({ nullable: true, required: false })
  description: string | null;

  @ApiProperty({ nullable: true, required: false })
  primaryColor: string | null;

  @ApiProperty({ nullable: true, required: false })
  organizerName: string | null;

  @ApiProperty({ nullable: true, required: false })
  photoUrl: string | null;

  @ApiProperty({ nullable: true, required: false })
  location: string | null;

  @ApiProperty({ nullable: true, required: false })
  contactEmail: string | null;

  @ApiProperty({ nullable: true, required: false })
  organizerUuid: string | null;

  @ApiProperty({ nullable: true, required: false })
  registerFormUuid: string | null;
}
