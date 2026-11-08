import { PartialType } from "@nestjs/swagger";

import { ParticipantCreateDto } from "./participant-create.dto";

export class ParticipantUpdateDto extends PartialType(ParticipantCreateDto) {}
