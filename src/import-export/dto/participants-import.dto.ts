import { ApiProperty } from "@nestjs/swagger";
import { Type } from "class-transformer";
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  ValidateNested,
} from "class-validator";
import { ParticipantCreateDto } from "src/participants/dto/participant-create.dto";

export class ParticipantsImportDto {
  @ApiProperty({
    description: "Array of participants to import",
    type: ParticipantCreateDto,
    isArray: true,
    minItems: 1,
    maxItems: 2000,
  })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(2000)
  @ValidateNested({ each: true })
  @Type(() => ParticipantCreateDto)
  participants: ParticipantCreateDto[];
}
