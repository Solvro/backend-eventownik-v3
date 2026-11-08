import { PartialType } from "@nestjs/mapped-types";

import { EventLinkCreateDto } from "./event-link-create.dto";

export class EventLinkUpdateDto extends PartialType(EventLinkCreateDto) {}
