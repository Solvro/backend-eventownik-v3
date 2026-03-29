import { IsOptional, IsString } from "class-validator";

import { ApiPropertyOptional } from "@nestjs/swagger";

export class FormSubmitionDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  email?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  participantId?: string;

  [key: string]: unknown;
}
