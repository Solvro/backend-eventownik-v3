import {
  ArrayMinSize,
  ArrayUnique,
  IsArray,
  IsEmail,
  IsEnum,
  IsNotEmpty,
} from "class-validator";
import { PermissionType } from "src/generated/prisma/client";

import { ApiProperty } from "@nestjs/swagger";

export class CreateOrganizerDto {
  @IsArray()
  @ArrayUnique()
  @ArrayMinSize(1)
  @IsEnum(PermissionType, { each: true })
  permissions: PermissionType[];

  @ApiProperty()
  @IsEmail()
  @IsNotEmpty()
  email: string;
}
