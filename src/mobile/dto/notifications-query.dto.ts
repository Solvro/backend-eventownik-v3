import { Type } from "class-transformer";
import { IsInt, IsOptional, Min } from "class-validator";

export class MobileNotificationsQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  afterSeq?: number;
}
