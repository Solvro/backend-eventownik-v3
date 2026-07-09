import { ApiProperty } from "@nestjs/swagger";

export class FileUploadResponseDto {
  @ApiProperty({
    description: "File token (UUID) for referencing in form submission",
  })
  fileToken: string;

  @ApiProperty({
    description: "Unix timestamp when this token expires",
  })
  expiresAt: number;
}
