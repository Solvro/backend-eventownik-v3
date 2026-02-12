import { ArrayUnique, IsArray, IsEmail, IsUUID } from "class-validator";

import { ApiProperty } from "@nestjs/swagger";

export class CreateOrganizerDto {
  @ApiProperty({ isArray: true })
  @IsUUID("4", { each: true })
  @IsArray()
  @ArrayUnique()
  permissionIds: string[];

  @ApiProperty()
  @IsEmail()
  email: string;
}
