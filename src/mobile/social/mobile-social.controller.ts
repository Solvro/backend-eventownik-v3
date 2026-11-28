import { memoryStorage } from "multer";

import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseIntPipe,
  ParseUUIDPipe,
  Post,
  Put,
  Query,
  UploadedFile,
  UploadedFiles,
  UseGuards,
  UseInterceptors,
} from "@nestjs/common";
import {
  FileFieldsInterceptor,
  FileInterceptor,
} from "@nestjs/platform-express";
import { ApiBearerAuth, ApiConsumes, ApiTags } from "@nestjs/swagger";

import { CurrentParticipant } from "../auth/current-participant.decorator";
import type { ParticipantContext } from "../auth/current-participant.decorator";
import { ParticipantAuthGuard } from "../auth/participant-auth.guard";
import { MobileEventService } from "../common/mobile-event.service";
import { MOBILE_IMAGE_MAX_BYTES } from "../common/mobile-image.service";
import {
  ChatMessagesQueryDto,
  CreateBerealPostDto,
  GifSearchQueryDto,
  SaveSoundboardPadDto,
  SendChatMessageDto,
  SwipeDto,
  TinderCandidatesQueryDto,
} from "./dto/social.dto";
import { MobileBerealService } from "./mobile-bereal.service";
import { MobileBingoService } from "./mobile-bingo.service";
import { MobileChatService } from "./mobile-chat.service";
import { MobileGifService } from "./mobile-gif.service";
import { MobileSoundboardService } from "./mobile-soundboard.service";
import { MobileTinderService } from "./mobile-tinder.service";
import type {
  MobileBerealPostDto,
  MobileBerealStateDto,
  MobileBingoBoardDto,
  MobileBingoLeaderboardEntryDto,
  MobileChatMessageDto,
  MobileChatRoomDto,
  MobileGifSearchDto,
  MobileSoundboardDto,
  MobileSwipeResultDto,
  MobileTinderCandidateDto,
  MobileTinderMatchDto,
} from "./social.types";

const uploadOptions = {
  storage: memoryStorage(),
  limits: { fileSize: MOBILE_IMAGE_MAX_BYTES, files: 2 },
};

@ApiTags("Mobile")
@ApiBearerAuth()
@UseGuards(ParticipantAuthGuard)
@Controller("mobile/events/:eventSlug")
export class MobileSocialController {
  constructor(
    private readonly mobileEventService: MobileEventService,
    private readonly chatService: MobileChatService,
    private readonly tinderService: MobileTinderService,
    private readonly bingoService: MobileBingoService,
    private readonly berealService: MobileBerealService,
    private readonly gifService: MobileGifService,
    private readonly soundboardService: MobileSoundboardService,
  ) {}

  // ---------------------------------------------------------------- Chat

  @Get("chat/rooms")
  async chatRooms(
    @CurrentParticipant() me: ParticipantContext,
  ): Promise<MobileChatRoomDto[]> {
    await this.mobileEventService.assertFeature(me.eventUuid, "chat");
    return this.chatService.listRooms(me);
  }

  @Get("chat/rooms/:roomUuid/messages")
  async chatMessages(
    @CurrentParticipant() me: ParticipantContext,
    @Param("roomUuid", ParseUUIDPipe) roomUuid: string,
    @Query() query: ChatMessagesQueryDto,
  ): Promise<MobileChatMessageDto[]> {
    await this.mobileEventService.assertFeature(me.eventUuid, "chat");
    return this.chatService.listMessages(me, roomUuid, query);
  }

  @Get("chat/gifs")
  async searchGifs(
    @CurrentParticipant() me: ParticipantContext,
    @Query() query: GifSearchQueryDto,
  ): Promise<MobileGifSearchDto> {
    await this.mobileEventService.assertFeature(me.eventUuid, "chat");
    return this.gifService.search(me.uuid, query.q ?? "", query.offset ?? 0);
  }

  @Post("chat/rooms/:roomUuid/messages")
  async sendChatMessage(
    @CurrentParticipant() me: ParticipantContext,
    @Param("roomUuid", ParseUUIDPipe) roomUuid: string,
    @Body() dto: SendChatMessageDto,
  ): Promise<MobileChatMessageDto> {
    await this.mobileEventService.assertFeature(me.eventUuid, "chat");
    return this.chatService.sendMessage(
      me,
      roomUuid,
      dto.body,
      dto.replyToUuid,
      dto.gif,
    );
  }

  // ---------------------------------------------------------------- Tinder

  @Get("tinder/candidates")
  async tinderCandidates(
    @CurrentParticipant() me: ParticipantContext,
    @Query() query: TinderCandidatesQueryDto,
  ): Promise<MobileTinderCandidateDto[]> {
    await this.mobileEventService.assertFeature(me.eventUuid, "tinder");
    return this.tinderService.candidates(me, query.limit ?? 20);
  }

  @Post("tinder/swipes")
  @HttpCode(200)
  async tinderSwipe(
    @CurrentParticipant() me: ParticipantContext,
    @Body() dto: SwipeDto,
  ): Promise<MobileSwipeResultDto> {
    await this.mobileEventService.assertFeature(me.eventUuid, "tinder");
    return this.tinderService.swipe(me, dto.toParticipantUuid, dto.liked);
  }

  @Get("tinder/matches")
  async tinderMatches(
    @CurrentParticipant() me: ParticipantContext,
  ): Promise<MobileTinderMatchDto[]> {
    await this.mobileEventService.assertFeature(me.eventUuid, "tinder");
    return this.tinderService.matches(me);
  }

  // ---------------------------------------------------------------- Bingo

  @Get("bingo")
  async bingoBoard(
    @CurrentParticipant() me: ParticipantContext,
  ): Promise<MobileBingoBoardDto> {
    await this.mobileEventService.assertFeature(me.eventUuid, "bingo");
    return this.bingoService.board(me);
  }

  @Get("bingo/leaderboard")
  async bingoLeaderboard(
    @CurrentParticipant() me: ParticipantContext,
  ): Promise<MobileBingoLeaderboardEntryDto[]> {
    await this.mobileEventService.assertFeature(me.eventUuid, "bingo");
    return this.bingoService.leaderboard(me);
  }

  @Post("bingo/tasks/:taskUuid/complete")
  @HttpCode(200)
  @ApiConsumes("multipart/form-data")
  @UseInterceptors(FileInterceptor("photo", uploadOptions))
  async bingoComplete(
    @CurrentParticipant() me: ParticipantContext,
    @Param("taskUuid", ParseUUIDPipe) taskUuid: string,
    @UploadedFile() photo: Express.Multer.File | undefined,
    @Body("note") note: unknown,
  ): Promise<MobileBingoBoardDto> {
    await this.mobileEventService.assertFeature(me.eventUuid, "bingo");
    return this.bingoService.complete(me, taskUuid, photo, note);
  }

  @Delete("bingo/tasks/:taskUuid/complete")
  async bingoUncomplete(
    @CurrentParticipant() me: ParticipantContext,
    @Param("taskUuid", ParseUUIDPipe) taskUuid: string,
  ): Promise<MobileBingoBoardDto> {
    await this.mobileEventService.assertFeature(me.eventUuid, "bingo");
    return this.bingoService.uncomplete(me, taskUuid);
  }

  // ---------------------------------------------------------------- BeReal

  @Get("bereal")
  async berealState(
    @CurrentParticipant() me: ParticipantContext,
  ): Promise<MobileBerealStateDto> {
    await this.mobileEventService.assertFeature(me.eventUuid, "bereal");
    return this.berealService.state(me);
  }

  @Post("bereal/rounds/:roundUuid/posts")
  @ApiConsumes("multipart/form-data")
  @UseInterceptors(
    FileFieldsInterceptor(
      [
        { name: "photo", maxCount: 1 },
        { name: "selfie", maxCount: 1 },
      ],
      uploadOptions,
    ),
  )
  async berealPost(
    @CurrentParticipant() me: ParticipantContext,
    @Param("roundUuid", ParseUUIDPipe) roundUuid: string,
    @UploadedFiles()
    files:
      | { photo?: Express.Multer.File[]; selfie?: Express.Multer.File[] }
      | undefined,
    @Body() dto: CreateBerealPostDto,
  ): Promise<MobileBerealPostDto> {
    await this.mobileEventService.assertFeature(me.eventUuid, "bereal");
    return this.berealService.createPost(
      me,
      roundUuid,
      files ?? {},
      dto.caption,
    );
  }

  @Get("bereal/rounds/:roundUuid/posts")
  async berealFeed(
    @CurrentParticipant() me: ParticipantContext,
    @Param("roundUuid", ParseUUIDPipe) roundUuid: string,
  ): Promise<MobileBerealPostDto[]> {
    await this.mobileEventService.assertFeature(me.eventUuid, "bereal");
    return this.berealService.feed(me, roundUuid);
  }

  // ---------------------------------------------------------------- Soundboard

  @Get("soundboard")
  async soundboard(
    @CurrentParticipant() me: ParticipantContext,
  ): Promise<MobileSoundboardDto> {
    await this.mobileEventService.assertFeature(me.eventUuid, "soundboard");
    return this.soundboardService.board(me.eventUuid);
  }

  @Put("soundboard/pads/:slot")
  @ApiConsumes("multipart/form-data")
  @UseInterceptors(
    FileFieldsInterceptor(
      [
        { name: "audio", maxCount: 1 },
        { name: "image", maxCount: 1 },
      ],
      uploadOptions,
    ),
  )
  async saveSoundboardPad(
    @CurrentParticipant() me: ParticipantContext,
    @Param("slot", ParseIntPipe) slot: number,
    @UploadedFiles()
    files:
      | { audio?: Express.Multer.File[]; image?: Express.Multer.File[] }
      | undefined,
    @Body() dto: SaveSoundboardPadDto,
  ): Promise<MobileSoundboardDto> {
    await this.mobileEventService.assertFeature(me.eventUuid, "soundboard");
    return this.soundboardService.save(me, slot, {
      caption: dto.caption,
      durationMs: dto.durationMs,
      removeImage: dto.removeImage,
      audio: files?.audio?.[0],
      image: files?.image?.[0],
    });
  }

  @Delete("soundboard/pads/:slot")
  async clearSoundboardPad(
    @CurrentParticipant() me: ParticipantContext,
    @Param("slot", ParseIntPipe) slot: number,
  ): Promise<MobileSoundboardDto> {
    await this.mobileEventService.assertFeature(me.eventUuid, "soundboard");
    return this.soundboardService.clear(me.eventUuid, slot);
  }
}
