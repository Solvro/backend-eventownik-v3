import type { EmailAttachmentDto } from "./email-attachment.dto";
import { EmailElementDto } from "./email-element.dto";

export class EmailCompleteElementDto extends EmailElementDto {
  content: string;
  attachments: EmailAttachmentDto[];
}
