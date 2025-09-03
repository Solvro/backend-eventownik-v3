import { Prisma } from "@prisma/client";
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
  @IsOptional()
  @IsObject()
  filter?: Record<
    string,
    string | string[] | Record<string, string | number | Date>
  >;

  @IsOptional()
  @Transform(({ value }): string[] =>
    typeof value === "string" ? value.split(",") : value,
  )
  @IsArray()
  @IsString({ each: true })
  join?: string[];

  @IsOptional()
  @Transform(({ value }): string[] =>
    typeof value === "string" ? value.split(",") : value,
  )
  @IsArray()
  @IsString({ each: true })
  select?: string[];

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

  @IsOptional()
  @IsObject()
  sort?: string | Record<string, "asc" | "desc">;

  toPrisma<T extends keyof Prisma.TypeMap["model"]>(
    _model: T,
  ): Prisma.TypeMap["model"][T]["operations"]["findMany"]["args"] {
    const query = {
      where: this.buildWhere(),
      select: this.buildSelect(),
      include: this.buildInclude(),
      skip: this.buildSkip(),
      take: this.buildTake(),
      orderBy: this.buildOrderBy(),
    };
    return query;
  }

  private buildWhere(): Record<string, unknown> | undefined {
    if (this.filter === undefined) {
      return undefined;
    }

    const where: Record<string, unknown> = {};

    for (const [key, value] of Object.entries(this.filter)) {
      const columns = key.split(",");
      const operatorConditions: Record<string, unknown> = {};
      if (typeof value === "string") {
        operatorConditions.in = value
          .split(",")
          .map((x) => (Number.isNaN(Number(x)) ? x : Number(x)));
      } else if (typeof value === "object") {
        // gt, gte, lt, lte, not, like...
        for (const [op, rawValue] of Object.entries(value)) {
          if (op === "like") {
            operatorConditions.contains = rawValue;
          } else {
            if (!Number.isNaN(Number(rawValue))) {
              operatorConditions[op] = Number(rawValue);
            } else if (!Number.isNaN(Date.parse(String(rawValue)))) {
              operatorConditions[op] = new Date(rawValue);
            }
          }
        }
      }
      where.OR = columns.map((col) => ({
        [col]: operatorConditions,
      }));
    }
    return where;
  }

  private buildSelect(): Record<string, boolean> | undefined {
    if (this.select === undefined) {
      return undefined;
    }

    return Object.fromEntries(this.select.map((field) => [field, true]));
  }

  private buildInclude(): Record<string, boolean> | undefined {
    if (this.join === undefined) {
      return undefined;
    }

    return Object.fromEntries(this.join.map((relation) => [relation, true]));
  }

  private buildSkip(): number | undefined {
    if (this.page == null || this.perPage == null) {
      return undefined;
    }
    return (this.page - 1) * this.perPage;
  }

  private buildTake(): number | undefined {
    return this.perPage;
  }

  private buildOrderBy():
    | Record<string, "asc" | "desc">
    | Record<string, "asc" | "desc">[]
    | undefined {
    if (this.sort === undefined) {
      return undefined;
    }

    if (typeof this.sort === "string") {
      return { uuid: this.sort as "asc" | "desc" };
    }

    return Object.entries(this.sort).map(([field, order]) => ({
      [field]: order,
    }));
  }
}
