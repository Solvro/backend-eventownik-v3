import { Type } from "class-transformer";
import { IsArray, IsOptional, IsString, ValidateNested } from "class-validator";

import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";

export class ParticipantAttributeDto {
  @ApiProperty()
  @IsString()
  attributeUuid: string;

  @ApiPropertyOptional({
    description:
      "Value for the participant attribute: \n - For files: write the send filename \n -For multiselekt write options with ; as separator",
  })
  @IsOptional()
  @IsString()
  value?: string;
}

export class FormSubmitionDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  email?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  participantId?: string;

  @ApiProperty({
    isArray: true,
    description: "Array of participant attributes with their values",
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ParticipantAttributeDto)
  attributes: ParticipantAttributeDto[];
}
