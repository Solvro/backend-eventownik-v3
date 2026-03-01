import { PickType } from "@nestjs/swagger";

import { CreateOrganizerDto } from "./create-organizer.dto";

export class UpdateOrganizerDto extends PickType(CreateOrganizerDto, [
  "permissionIds",
] as const) {}
