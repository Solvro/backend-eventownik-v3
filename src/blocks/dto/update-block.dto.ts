import { IsUUID } from "class-validator";

import { ApiProperty, PartialType } from "@nestjs/swagger";

import { CreateBlockDto } from "./create-block.dto";

export class UpdateBlockDto extends PartialType(CreateBlockDto) {
  @ApiProperty({ example: "3d2f558c-df42-477d-bb2b-674fce2e886a" })
  @IsUUID()
  parentUuid: string;
}
