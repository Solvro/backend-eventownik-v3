import { EmailStatus, EmailTrigger } from "src/generated/prisma/client";

import { ApiProperty } from "@nestjs/swagger";

export class ParticipantEmailStatus {
  @ApiProperty({ description: "UUID of the email status" })
  uuid: string;

  @ApiProperty({ enum: EmailStatus, description: "Status of the email" })
  status: EmailStatus;

  @ApiProperty({ description: "Date when the email was sent" })
  sendAt: Date;

  @ApiProperty({
    description: "User or system that sent the email",
    nullable: true,
  })
  sendBy: string | null;

  @ApiProperty({ description: "Name of the email template", nullable: true })
  name?: string;

  @ApiProperty({ description: "Content of the email", nullable: true })
  content?: string;

  @ApiProperty({
    enum: EmailTrigger,
    description: "Trigger of the email",
    nullable: true,
  })
  trigger?: EmailTrigger;

  @ApiProperty({ description: "Trigger value", nullable: true })
  triggerValue?: string | null;
}
