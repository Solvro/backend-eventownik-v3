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
  ValidateNested,
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

export class ChatGifDto {
  @IsString()
  @MaxLength(500)
  url: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(2000)
  width: number;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(2000)
  height: number;
}

export class SendChatMessageDto {
  /** May be empty when the message is a GIF */
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(1000)
  body?: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => ChatGifDto)
  gif?: ChatGifDto;

  /** Message in the same room this one replies to */
  @IsOptional()
  @IsUUID()
  replyToUuid?: string;
}

export class GifSearchQueryDto {
  @IsOptional()
  @IsString()
  @MaxLength(50)
  q?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(4999)
  offset?: number;
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

/** Multipart fields that come with a soundboard pad's sound and picture */
export class SaveSoundboardPadDto {
  @Transform(trim)
  @IsString()
  @MinLength(1)
  @MaxLength(40)
  caption!: string;

  /** Length of the recording, measured by the app */
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(60_000)
  durationMs?: number;

  /** "true" drops the current picture when no new one is sent */
  @IsOptional()
  @Transform(
    ({ value }: { value: unknown }) => value === true || value === "true",
  )
  @IsBoolean()
  removeImage?: boolean;
}
