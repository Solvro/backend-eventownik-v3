import { PartialType } from "@nestjs/swagger";

import { CreateEmailDto } from "./create-email.dto";

export class UpdateEmailDto extends PartialType(CreateEmailDto) {}
