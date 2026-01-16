import { Type } from "class-transformer";
import { IsInt, IsOptional, IsString, Max, Min } from "class-validator";

import { ApiPropertyOptional } from "@nestjs/swagger";

export class PageOptionsDto {
  @ApiPropertyOptional({ minimum: 1, default: 1 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @IsOptional()
  readonly page?: number = 1;

  @ApiPropertyOptional({ minimum: 1, maximum: 100, default: 10 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  @IsOptional()
  readonly take?: number = 10;

  get skip(): number {
    return ((this.page ?? 1) - 1) * (this.take ?? 10);
  }

  @ApiPropertyOptional({
    description: "Sort format: field:order",
    example: "email:asc, createdAt:desc",
  })
  @IsOptional()
  @IsString()
  readonly sort?: string;
}
