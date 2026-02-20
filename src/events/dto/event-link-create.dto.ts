import { IsEnum, IsOptional, IsString } from "class-validator";
import { EventLinkType } from "src/generated/prisma/enums";

import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";

export class EventLinkCreateDto {
  @ApiProperty({
    description: "URL of the link",
    type: String,
    example: "https://event-website.com",
  })
  @IsString()
  url: string;

  @ApiProperty({
    description: "Type of the event link",

    enum: EventLinkType,
    example: "general",
  })
  @IsEnum(EventLinkType)
  type: EventLinkType;

  @ApiPropertyOptional({
    description: "Optional label for the event link",
    type: String,
    example: "Official Website",
    required: false,
  })
  @IsOptional()
  @IsString()
  label?: string;
}

export class EventCreateDto {
  @ApiProperty({
    description: "Name of the event",
    type: String,
    example: "Tech Conference 2023",
  })
  @IsString()
  readonly name: string;
}
