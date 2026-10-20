import { ApiProperty } from "@nestjs/swagger";

export class EmailAttachmentDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  originalName: string;

  @ApiProperty()
  mimeType: string;

  @ApiProperty()
  size: number;
}
