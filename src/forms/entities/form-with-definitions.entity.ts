import { Attribute } from "src/attributes/entities/attribute.entity";
import { OpenCondition } from "src/generated/prisma/enums";

import { ApiProperty } from "@nestjs/swagger";

export class FormDefinitionWithAttribute {
  uuid: string;
  isRequired: boolean;
  order: number | null;
  attributeUuid: string | null;
  formUuid: string | null;
  createdAt: Date;
  updatedAt: Date;
  attribute: Attribute | null;
}

export class FormWithDefinitions {
  uuid: string;
  name: string;
  isEditable: boolean;
  isOpen: boolean;

  @ApiProperty({ enum: OpenCondition })
  openCondition: OpenCondition;

  openDate: Date | null;
  closeDate: Date | null;
  description: string | null;
  order: number | null;
  eventUuid: string | null;
  createdAt: Date;
  updatedAt: Date;
  formDefinitions: FormDefinitionWithAttribute[];
}
