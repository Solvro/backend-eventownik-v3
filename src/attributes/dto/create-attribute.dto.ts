import { AttributeType } from "@prisma/client";
import { IsBoolean, IsEnum, IsOptional, IsString } from "class-validator";

export class CreateAttributeDto {
  @IsString()
  eventUuid: string;

  @IsEnum(AttributeType)
  type: AttributeType;

  @IsOptional()
  @IsBoolean()
  showInList?: boolean;

  @IsOptional()
  @IsString({ each: true })
  options?: string[];

  @IsOptional()
  @IsString()
  name?: string;
}
