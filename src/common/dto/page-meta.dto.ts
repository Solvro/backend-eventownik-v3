import { ApiProperty } from "@nestjs/swagger";

import { PageOptionsDto } from "./page-options.dto";

export interface PageMetaDtoParameters {
  pageOptionsDto: PageOptionsDto;
  itemCount: number;
}

export class PageMetaDto {
  @ApiProperty() readonly page: number;
  @ApiProperty() readonly take: number;
  @ApiProperty() readonly itemCount: number;
  @ApiProperty() readonly pageCount: number;
  @ApiProperty() readonly hasPreviousPage: boolean;
  @ApiProperty() readonly hasNextPage: boolean;

  constructor({ pageOptionsDto, itemCount }: PageMetaDtoParameters) {
    this.page = pageOptionsDto.page || 1;
    this.take = pageOptionsDto.take || 10;
    this.itemCount = itemCount;
    this.pageCount = Math.ceil(itemCount / this.take);
    this.hasPreviousPage = this.page > 1;
    this.hasNextPage = this.page < this.pageCount;
  }
}
