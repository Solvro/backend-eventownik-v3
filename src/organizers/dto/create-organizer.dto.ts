import {
  ArrayMinSize,
  ArrayUnique,
  IsArray,
  IsEmail,
  IsNotEmpty,
  IsUUID,
} from "class-validator";

import { ApiProperty } from "@nestjs/swagger";

export class CreateOrganizerDto {
  @ApiProperty({ isArray: true })
  @IsUUID("4", { each: true })
  @IsArray()
  @ArrayUnique()
  @ArrayMinSize(1)
  permissionIds: string[];

  @ApiProperty()
  @IsEmail()
  @IsNotEmpty()
  email: string;
}
