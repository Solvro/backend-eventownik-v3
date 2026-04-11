import { IsBoolean, IsEmail, IsEnum, IsString } from "class-validator";
import type { OrganizerType } from "src/generated/prisma/enums";

import { ApiProperty } from "@nestjs/swagger";

export class CreateAdminDto {
  @ApiProperty({
    description: "First name of the admin",
    example: "John",
    type: String,
  })
  @IsString()
  firstName!: string;

  @ApiProperty({
    description: "Last name of the admin",
    example: "Doe",
    type: String,
  })
  @IsString()
  lastName!: string;

  @ApiProperty({
    description: "Email of the admin",
    example: "john.doe@example.com",
    type: String,
  })
  @IsEmail()
  email!: string;

  @ApiProperty({
    description: "Password of the admin",
    example: "strongpassword123",
    type: String,
  })
  @IsString()
  password!: string;

  @ApiProperty({
    description: "Type of the admin",
    example: "organizer",
    enum: ["organizer", "superadmin"],
  })
  @IsEnum(["organizer", "superadmin"])
  type!: OrganizerType;

  @ApiProperty({
    description: "Whether the admin is active",
    example: true,
    type: Boolean,
  })
  @IsBoolean()
  active!: boolean;
}
