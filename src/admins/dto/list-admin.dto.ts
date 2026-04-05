import { PageOptionsDto } from "src/common/dto/page-options.dto";
import { OrganizerType } from "src/generated/prisma/enums";

import { ApiPropertyOptional } from "@nestjs/swagger";

export class ListAdminDto extends PageOptionsDto {
  @ApiPropertyOptional({ description: "Filter by admin's email" })
  readonly email?: string;

  @ApiPropertyOptional({ description: "Filter by admin's first name" })
  readonly firstName?: string;

  @ApiPropertyOptional({ description: "Filter by admin's last name" })
  readonly lastName?: string;

  @ApiPropertyOptional({ description: "Filter by admin's type" })
  readonly type?: OrganizerType;

  // TODO: add more filtering options ;P
}
