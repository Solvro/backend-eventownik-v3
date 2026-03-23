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
  @ApiProperty({ description: "UUID of the attribute" })
  @IsUUID()
  @IsNotEmpty()
  attributeUuid: string;

  @ApiPropertyOptional({
    description: "Value of the attribute",
    nullable: true,
  })
  @IsString()
  @IsOptional()
  value: string | null;
}

export class ParticipantCreateDto {
  @ApiProperty({ description: "Email of the participant" })
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
