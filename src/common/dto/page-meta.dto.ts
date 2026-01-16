import { ApiProperty } from "@nestjs/swagger";

import { PageOptionsDto } from "./page-options.dto";

export interface PageMetaDtoParameters {
  pageOptionsDto: PageOptionsDto;
  itemCount: number;
}

export class PageMetaDto {
  @ApiProperty({ description: "Current page number" })
  readonly page: number;

  @ApiProperty({ description: "Number of items per page" })
  readonly take: number;

  @ApiProperty({ description: "Total number of items" })
  readonly itemCount: number;

  @ApiProperty({ description: "Total number of pages" })
  readonly pageCount: number;

  @ApiProperty({ description: "Has previous page" })
  readonly hasPreviousPage: boolean;

  @ApiProperty({ description: "Has next page" })
  readonly hasNextPage: boolean;

  constructor({ pageOptionsDto, itemCount }: PageMetaDtoParameters) {
    this.page = pageOptionsDto.page ?? 1;
    this.take = pageOptionsDto.take ?? 10;
    this.itemCount = itemCount;
    this.pageCount = Math.ceil(itemCount / this.take);
    this.hasPreviousPage = this.page > 1;
    this.hasNextPage = this.page < this.pageCount;
  }
}
