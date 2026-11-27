import { Transform, Type } from "class-transformer";
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  MinLength,
} from "class-validator";

const trim = ({ value }: { value: unknown }): unknown =>
  typeof value === "string" ? value.trim() : value;

const emptyToUndefined = ({ value }: { value: unknown }): unknown => {
  if (typeof value !== "string") {
    return value;
  }
  const trimmed = value.trim();
  return trimmed === "" ? undefined : trimmed;
};

// ---------------------------------------------------------------------------
// Chat
// ---------------------------------------------------------------------------

/** Filters for the organizer's list of bingo completions */
export class BingoCompletionsQueryDto {
  @IsOptional()
  @IsUUID()
  taskUuid?: string;

  @IsOptional()
  @IsUUID()
  participantUuid?: string;
}

export class ChatMessagesQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  afterSeq?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  beforeSeq?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;
}

export class SendChatMessageDto {
  @Transform(trim)
  @IsString()
  @MinLength(1)
  @MaxLength(1000)
  body: string;
}

// ---------------------------------------------------------------------------
// Tinder
// ---------------------------------------------------------------------------

export class TinderCandidatesQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  limit?: number;
}

export class SwipeDto {
  @IsUUID()
  toParticipantUuid: string;

  @IsBoolean()
  liked: boolean;
}

// ---------------------------------------------------------------------------
// BeReal
// ---------------------------------------------------------------------------

export class CreateBerealPostDto {
  @IsOptional()
  @Transform(emptyToUndefined)
  @IsString()
  @MaxLength(200)
  caption?: string;
}

export class CreateBerealRoundDto {
  @IsOptional()
  @Transform(emptyToUndefined)
  @IsString()
  @MaxLength(200)
  prompt?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(120)
  durationMinutes?: number;
}

// ---------------------------------------------------------------------------
// Bingo (organizer)
// ---------------------------------------------------------------------------

export class CreateBingoTaskDto {
  @Transform(trim)
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  text: string;
}

export class BulkCreateBingoTasksDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(100)
  @Transform(({ value }: { value: unknown }) =>
    Array.isArray(value)
      ? value.map((item: unknown) =>
          typeof item === "string" ? item.trim() : item,
        )
      : value,
  )
  @IsString({ each: true })
  @MinLength(1, { each: true })
  @MaxLength(200, { each: true })
  texts: string[];
}

export class UpdateBingoTaskDto {
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  text?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  order?: number;
}
