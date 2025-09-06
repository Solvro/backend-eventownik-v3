import { ApiProperty } from "@nestjs/swagger";

export class ParticipantResponse {
  @ApiProperty({ format: "uuid" })
  uuid!: string;

  @ApiProperty({ example: "user@example.com" })
  email!: string;

  @ApiProperty({ type: String, format: "date-time" })
  created_at!: Date;

  @ApiProperty({ type: String, format: "date-time" })
  updated_at!: Date;

  @ApiProperty({ type: "object", additionalProperties: { type: "string" } })
  attributes!: Record<string, string>;

  @ApiProperty({ example: 0 })
  emails_pending!: number;

  @ApiProperty({ example: 0 })
  emails_sent!: number;

  @ApiProperty({ example: 0 })
  emails_failed!: number;
}

export class ParticipantListResponse {
  @ApiProperty({ type: [ParticipantResponse] })
  data!: ParticipantResponse[];

  @ApiProperty({
    type: "object",
    properties: {
      page: { type: "number" },
      per_page: { type: "number" },
      total: { type: "number" },
      total_pages: { type: "number" },
    },
  })
  metadata!: {
    page: number;
    per_page: number;
    total: number;
    total_pages: number;
  };
}
