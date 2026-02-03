import { Type } from "class-transformer";
import {
  IsArray,
  IsBoolean,
  IsDate,
  IsEmail,
  IsNumber,
  IsOptional,
  IsString,
  MinLength,
} from "class-validator";

import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";

export class EventCreateDto {
  @ApiProperty({
    description: "Name of the event",
    type: String,
    example: "Tech Conference 2023",
  })
  @IsString()
  readonly name: string;

  @ApiPropertyOptional({
    description: "Array of links related to the event",
    isArray: true,
    type: String,
    example: ["https://event-website.com", "https://tickets.com"],
  })
  @IsOptional()
  @IsArray()
  links?: string[];

  @ApiPropertyOptional({
    description: "Array of policy links related to the event",
    isArray: true,
    type: String,
    example: ["https://event-privacy.com", "https://event-terms.com"],
  })
  @IsOptional()
  @IsArray()
  policyLinks?: string[];

  @ApiProperty({
    description: "Start date of the event",
    type: String,
    example: "2022-12-12 12:12:12",
  })
  @Type(() => Date)
  @IsDate()
  startDate: Date;

  @ApiProperty({
    description: "End date of the event",
    type: String,
    example: "2022-12-12 12:12:12",
  })
  @Type(() => Date)
  @IsDate()
  endDate: Date;

  @ApiProperty({
    description: "Is the event public, defaults to false",
    type: Boolean,
    example: true,
  })
  @IsBoolean()
  isPublic: boolean;

  @ApiPropertyOptional({
    description: "Participants limit for the event",
    type: Number,
    example: 100,
  })
  @IsOptional()
  @IsNumber()
  participantsLimit?: number | null;

  @ApiPropertyOptional({
    description: "Description of the event",
    type: String,
    example: "An exciting tech conference",
  })
  @IsOptional()
  @IsString()
  description?: string | null;

  @ApiPropertyOptional({
    description: "Primary color associated with the event",
    type: String,
    example: "#FF5733",
  })
  @IsOptional()
  @IsString()
  primaryColor?: string | null;

  @ApiPropertyOptional({
    description: "Organizer name of the event",
    type: String,
    example: "KN Solvro",
  })
  @IsOptional()
  @IsString()
  organizerName?: string | null;

  @ApiPropertyOptional({
    description: "Photo URL of the event",
    type: String,
    example: "https://event-photo.com/photo.jpg",
  })
  @IsOptional()
  @IsString()
  photoUrl?: string | null;

  @ApiPropertyOptional({
    description: "Location of the event",
    type: String,
    example: "PWr, Poland",
  })
  @IsOptional()
  @IsString()
  location?: string | null;

  @ApiPropertyOptional({
    description: "Contact email for the event",
    type: String,
    example: "contact@eventownik.com",
  })
  @IsOptional()
  @IsString()
  @IsEmail()
  contactEmail?: string | null;

  @ApiProperty({
    description: "Unique slug for the event",
    type: String,
    example: "tech-conference-2023",
  })
  @IsString()
  @MinLength(3)
  slug: string;
}
