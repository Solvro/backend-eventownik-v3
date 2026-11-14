import { ApiProperty } from "@nestjs/swagger";

export class RequestLoginCodeResponseDTO {
  @ApiProperty({
    example: "If this email is registered, a login code has been sent.",
  })
  message: string;
}
