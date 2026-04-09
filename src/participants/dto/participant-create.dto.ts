import { Type } from "class-transformer";
import {
  IsArray,
  IsEmail,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  ValidateNested,
} from "class-validator";

import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";

export class ParticipantAttributeDto {
  @ApiProperty({
    description: "UUID of the attribute",
    example: "550e8400-e29b-41d4-a716-446655440000",
  })
  @IsUUID()
  @IsNotEmpty()
  attributeUuid: string;

  @ApiPropertyOptional({
    description: "Value of the attribute",
    nullable: true,
    example: "John Doe",
  })
  @IsString()
  @IsOptional()
  value: string | null;
}

export class ParticipantCreateDto {
  @ApiProperty({
    description: "Email of the participant",
    example: "participant@example.com",
  })
  @IsEmail()
  @IsNotEmpty()
  email: string;

  @ApiPropertyOptional({ type: [ParticipantAttributeDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ParticipantAttributeDto)
  @IsOptional()
  participantAttributes?: ParticipantAttributeDto[];
}
