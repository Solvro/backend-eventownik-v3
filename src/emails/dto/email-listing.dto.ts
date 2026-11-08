import { PageOptionsDto } from "src/common/dto/page-options.dto";
import type { EmailTrigger } from "src/generated/prisma/enums";

export class EmailListingDto extends PageOptionsDto {
  trigger?: EmailTrigger;
}
