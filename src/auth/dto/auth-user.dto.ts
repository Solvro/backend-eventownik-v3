import { Admin, OrganizerType } from "src/generated/prisma/client";

import { ApiProperty } from "@nestjs/swagger";

export class AdminDto implements Omit<Admin, "password"> {
  @ApiProperty({ example: "123e4567-e89b-12d3-a456-426614174000" })
  uuid!: string;

  @ApiProperty({ example: "admin@example.com" })
  email!: string;

  @ApiProperty({ example: "John" })
  firstName!: string;

  @ApiProperty({ example: "Doe" })
  lastName!: string;

  @ApiProperty({ enum: ["superadmin", "organizer"], example: "organizer" })
  type!: OrganizerType;

  @ApiProperty({ example: true })
  active!: boolean;

  @ApiProperty({ example: "2023-01-01T00:00:00.000Z" })
  createdAt!: Date;

  @ApiProperty({ example: "2023-01-01T00:00:00.000Z" })
  updatedAt!: Date;
}
