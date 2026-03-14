import { ApiProperty } from "@nestjs/swagger";

export class Block {
  @ApiProperty({ example: "123e4567-e89b-12d3-a456-426614174000" })
  uuid: string;

  @ApiProperty({ example: "2023-01-01T00:00:00.000Z" })
  createdAt: Date;

  @ApiProperty({ example: "2023-01-01T00:00:00.000Z" })
  updatedAt: Date;

  @ApiProperty({ example: 100, nullable: true })
  capacity: number | null;

  @ApiProperty({ example: 1, nullable: true })
  order: number | null;

  @ApiProperty({ example: "Name of the block" })
  name: string;

  @ApiProperty({ example: "Description of the block", nullable: true })
  description: string | null;

  @ApiProperty({
    example: "6be19f27-b633-44f6-a09d-a442a04e598b",
    nullable: true,
  })
  parentUuid: string | null;

  @ApiProperty({
    example: "d687428d-7e3a-46f6-92a0-cef84e51b171",
    nullable: true,
  })
  attributeUuid: string | null;
}
