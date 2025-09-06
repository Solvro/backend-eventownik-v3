import { Transform, Type } from "class-transformer";
import { IsInt, IsObject, IsOptional, IsString, Min } from "class-validator";

import { ApiPropertyOptional } from "@nestjs/swagger";

export class QueryParticipantDto {
  @ApiPropertyOptional({ example: 1, minimum: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @ApiPropertyOptional({ example: 25, minimum: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  perPage?: number;

  @ApiPropertyOptional({
    type: "object",
    additionalProperties: { type: "string" },
    example: { email: "john" },
  })
  @IsOptional()
  @IsObject()
  filter?: Record<string, unknown>;

  @ApiPropertyOptional({
    type: "object",
    additionalProperties: { enum: ["asc", "desc"] },
    example: { created_at: "desc" },
  })
  @IsOptional()
  @IsObject()
  sort?: Record<string, unknown>;

  @ApiPropertyOptional({ example: "john" })
  @IsOptional()
  @IsString()
  @Transform(({ value }) => (typeof value === "string" ? value : undefined))
  search?: string;
}
