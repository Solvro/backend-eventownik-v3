import { IsArray, IsEmail, IsString, IsUUID } from "class-validator";

import { ApiProperty } from "@nestjs/swagger";

export class CreateOrganizerDto {
  @ApiProperty({ isArray: true })
  @IsUUID("4", { each: true })
  @IsArray()
  permissionIds: string[];

  @ApiProperty()
  @IsEmail()
  email: string;

  @ApiProperty()
  @IsString()
  firstName: string;

  @ApiProperty()
  @IsString()
  lastName: string;
}
