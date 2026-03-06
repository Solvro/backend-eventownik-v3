import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";

export class Block {
  @ApiProperty({ example: "123e4567-e89b-12d3-a456-426614174000" })
  uuid: string;

  @ApiProperty({ example: "2023-01-01T00:00:00.000Z" })
  createdAt: Date;

  @ApiProperty({ example: "2023-01-01T00:00:00.000Z" })
  updatedAt: Date;

  @ApiPropertyOptional({ example: 100 })
  capacity: number | null;

  @ApiPropertyOptional({ example: 1 })
  order: number | null;

  @ApiPropertyOptional({ example: "Name of the block" })
  name: string | null;

  @ApiPropertyOptional({ example: "Description of the block" })
  description: string | null;

  @ApiPropertyOptional({ example: "6be19f27-b633-44f6-a09d-a442a04e598b" })
  parentUuid: string | null;

  @ApiPropertyOptional({ example: "d687428d-7e3a-46f6-92a0-cef84e51b171" })
  attributeUuid: string | null;
}
