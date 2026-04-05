import type { OrganizerType } from "src/generated/prisma/enums";

import { ApiProperty } from "@nestjs/swagger";

export class CreateAdminDto {
  @ApiProperty({
    description: "First name of the admin",
    example: "John",
    type: String,
  })
  fistName!: string;

  @ApiProperty({
    description: "Last name of the admin",
    example: "Doe",
    type: String,
  })
  lastName!: string;

  @ApiProperty({
    description: "Email of the admin",
    example: "john.doe@example.com",
    type: String,
  })
  email!: string;

  @ApiProperty({
    description: "Password of the admin",
    example: "strongpassword123",
    type: String,
  })
  password!: string;

  @ApiProperty({
    description: "Type of the admin",
    example: "SUPER_ADMIN",
    enum: ["organizer", "superadmin"],
  })
  type!: OrganizerType;

  @ApiProperty({
    description: "Whether the admin is active",
    example: true,
    type: Boolean,
  })
  active!: boolean;
}
