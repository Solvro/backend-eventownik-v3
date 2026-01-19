/* eslint-disable @darraghor/nestjs-typed/validated-non-primitive-property-needs-type-decorator */
import { Type } from "class-transformer";
import { IsArray, IsDefined, ValidateNested } from "class-validator";

import { ApiProperty } from "@nestjs/swagger";

import { PageMetaDto } from "./page-meta.dto";

export class PageDto<T> {
  @IsArray()
  @ApiProperty({ isArray: true, description: "Array of items" })
  readonly data: T[];

  @ApiProperty({ type: () => PageMetaDto, description: "Pagination metadata" })
  @ValidateNested()
  @IsDefined()
  @Type(() => PageMetaDto)
  readonly meta: PageMetaDto;

  constructor(data: T[], meta: PageMetaDto) {
    this.data = data;
    this.meta = meta;
  }
}
