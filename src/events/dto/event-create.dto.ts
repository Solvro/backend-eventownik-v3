import { Transform, Type } from "class-transformer";
import {
  IsBoolean,
  IsDate,
  IsEmail,
  IsNumber,
  IsOptional,
  IsString,
  MinLength,
  ValidateNested,
} from "class-validator";

import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";

import { EventLinkCreateDto } from "./event-link-create.dto";

export class EventCreateDto {
  @ApiProperty({
    description: "Name of the event",
    type: String,
    example: "Tech Conference 2023",
  })
  @IsString()
  readonly name!: string;

  @ApiProperty({
    description: "Start date of the event",
    type: String,
    example: "2022-12-12 12:12:12",
  })
  @Type(() => Date)
  @IsDate()
  startDate!: Date;

  @ApiProperty({
    description: "End date of the event",
    type: String,
    example: "2022-12-12 12:12:12",
  })
  @Type(() => Date)
  @IsDate()
  endDate!: Date;

  @ApiProperty({
    description: "Is the event public, defaults to false",
    type: Boolean,
    example: true,
  })
  @Transform(({ value }) => value === "true" || value === true)
  @IsBoolean()
  isPublic!: boolean;

  @ApiPropertyOptional({
    description:
      "Verification status of the public event, defaults to false. Only superadmins can set it; ignored for organizers.",
    type: Boolean,
    example: true,
  })
  @IsOptional()
  @Transform(({ value }) => value === "true" || value === true)
  @IsBoolean()
  isVerified?: boolean;

  @ApiPropertyOptional({
    description: "Participants limit for the event",
    type: Number,
    example: 100,
  })
  @IsOptional()
  @Type(() => Number)
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
  slug!: string;

  @IsOptional()
  @ValidateNested({ each: true })
  @Type(() => EventLinkCreateDto)
  links?: EventLinkCreateDto[];
}
