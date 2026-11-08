import { EmailElementDto } from "./email-element.dto";

export class EmailListElementDto extends EmailElementDto {
  meta: {
    failedCount: number;
    pendingCount: number;
    sentCount: number;
  };
}
