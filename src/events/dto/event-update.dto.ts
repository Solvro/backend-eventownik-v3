import { PartialType } from "@nestjs/mapped-types";

import { EventCreateDto } from "./event-create.dto";

export class EventUpdateDto extends PartialType(EventCreateDto) {}
