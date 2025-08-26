import { Transform } from "class-transformer";
import {
  IsArray,
  IsNumber,
  IsObject,
  IsOptional,
  IsPositive,
  IsString,
} from "class-validator";

export class QueryListingDto {
  /**
   * Filtering
   * Examples:
   * ?filter[name]=John
   * ?filter[age][gte]=18
   * ?filter[createdAt][lt]=2024-01-01
   * ?filter[status][not]=inactive
   * ?filter[category]=a,b,c
   */
  @IsOptional()
  @IsObject()
  filter?: Record<
    string,
    string | string[] | Record<string, string | number | Date>
  >;

  /**
   * Relations
   * Examples:
   * ?join=profile
   * ?join=posts,comments
   */
  @IsOptional()
  @Transform(({ value }): string[] =>
    typeof value === "string" ? value.split(",") : value,
  )
  @IsArray()
  @IsString({ each: true })
  join?: string[];

  /**
   * Selects
   * Examples:
   * ?select=id
   * ?select=id,name,email
   */
  @IsOptional()
  @Transform(({ value }): string[] =>
    typeof value === "string" ? value.split(",") : value,
  )
  @IsArray()
  @IsString({ each: true })
  select?: string[];

  /**
   * Pagination
   * Examples:
   * ?page=2&perPage=50
   */
  @IsOptional()
  @Transform(({ value }) => Number(value))
  @IsNumber()
  @IsPositive()
  page?: number = 1;

  @IsOptional()
  @Transform(({ value }) => Number(value))
  @IsNumber()
  @IsPositive()
  perPage?: number = 25;

  /**
   * Sorting
   * Example:
   * ?sort[name]=asc
   * ?sort[createdAt]=desc
   * ?sort=asc - by default key
   */
  @IsOptional()
  @IsObject()
  sort?: string | Record<string, "asc" | "desc">;
}
