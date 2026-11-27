import { JwtAuthGuard } from "src/auth/jwt-auth.guard";
import type { AuthUser } from "src/auth/jwt.strategy";
import { RequirePermission } from "src/auth/permissions.decorator";
import { PermissionsGuard } from "src/auth/permissions.guard";
import { PermissionType } from "src/generated/prisma/enums";

import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";

import {
  BingoCompletionsQueryDto,
  BulkCreateBingoTasksDto,
  ChatMessagesQueryDto,
  CreateBerealRoundDto,
  CreateBingoTaskDto,
  SendChatMessageDto,
  UpdateBingoTaskDto,
} from "./dto/social.dto";
import { MobileBerealService } from "./mobile-bereal.service";
import { MobileBingoService } from "./mobile-bingo.service";
import { MobileChatService } from "./mobile-chat.service";
import { MobileTinderService } from "./mobile-tinder.service";
import type {
  MobileBerealPostDto,
  MobileBerealRoundAdminDto,
  MobileBingoCompletionAdminDto,
  MobileBingoTaskAdminDto,
  MobileChatMessageDto,
  MobileTinderOverviewDto,
  MobileTinderParticipantSwipesDto,
} from "./social.types";

@ApiTags("Mobile")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@RequirePermission([
  PermissionType.MANAGE_SETTINGS,
  PermissionType.MANAGE_EVENT,
])
@Controller("events/:eventId/mobile")
export class MobileSocialAdminController {
  constructor(
    private readonly chatService: MobileChatService,
    private readonly bingoService: MobileBingoService,
    private readonly berealService: MobileBerealService,
    private readonly tinderService: MobileTinderService,
  ) {}

  // ---------------------------------------------------------------- Tinderownik

  @Get("tinder")
  async tinderOverview(
    @Param("eventId", ParseUUIDPipe) eventId: string,
  ): Promise<MobileTinderOverviewDto> {
    return this.tinderService.adminOverview(eventId);
  }

  @Get("tinder/participants/:participantUuid")
  async tinderParticipantSwipes(
    @Param("eventId", ParseUUIDPipe) eventId: string,
    @Param("participantUuid", ParseUUIDPipe) participantUuid: string,
  ): Promise<MobileTinderParticipantSwipesDto> {
    return this.tinderService.adminParticipantSwipes(eventId, participantUuid);
  }

  // ---------------------------------------------------------------- Bingo

  @Get("bingo-tasks")
  async listBingoTasks(
    @Param("eventId", ParseUUIDPipe) eventId: string,
  ): Promise<MobileBingoTaskAdminDto[]> {
    return this.bingoService.listTasks(eventId);
  }

  @Post("bingo-tasks")
  async createBingoTask(
    @Param("eventId", ParseUUIDPipe) eventId: string,
    @Body() dto: CreateBingoTaskDto,
  ): Promise<MobileBingoTaskAdminDto> {
    return this.bingoService.createTask(eventId, dto.text);
  }

  @Post("bingo-tasks/bulk")
  async createBingoTasks(
    @Param("eventId", ParseUUIDPipe) eventId: string,
    @Body() dto: BulkCreateBingoTasksDto,
  ): Promise<MobileBingoTaskAdminDto[]> {
    return this.bingoService.createTasks(eventId, dto.texts);
  }

  @Patch("bingo-tasks/:uuid")
  async updateBingoTask(
    @Param("eventId", ParseUUIDPipe) eventId: string,
    @Param("uuid", ParseUUIDPipe) uuid: string,
    @Body() dto: UpdateBingoTaskDto,
  ): Promise<MobileBingoTaskAdminDto> {
    return this.bingoService.updateTask(eventId, uuid, dto);
  }

  @Delete("bingo-tasks/:uuid")
  @HttpCode(204)
  async deleteBingoTask(
    @Param("eventId", ParseUUIDPipe) eventId: string,
    @Param("uuid", ParseUUIDPipe) uuid: string,
  ): Promise<void> {
    await this.bingoService.deleteTask(eventId, uuid);
  }

  @Get("bingo-completions")
  async listBingoCompletions(
    @Param("eventId", ParseUUIDPipe) eventId: string,
    @Query() query: BingoCompletionsQueryDto,
  ): Promise<MobileBingoCompletionAdminDto[]> {
    return this.bingoService.listCompletions(eventId, query);
  }

  @Delete("bingo-completions/:uuid")
  @HttpCode(204)
  async deleteBingoCompletion(
    @Param("eventId", ParseUUIDPipe) eventId: string,
    @Param("uuid", ParseUUIDPipe) uuid: string,
  ): Promise<void> {
    await this.bingoService.deleteCompletion(eventId, uuid);
  }

  // ---------------------------------------------------------------- BeReal

  @Get("bereal-rounds")
  async listBerealRounds(
    @Param("eventId", ParseUUIDPipe) eventId: string,
  ): Promise<MobileBerealRoundAdminDto[]> {
    return this.berealService.listRounds(eventId);
  }

  @Post("bereal-rounds")
  async createBerealRound(
    @Param("eventId", ParseUUIDPipe) eventId: string,
    @Body() dto: CreateBerealRoundDto,
    @Req() request: { user: AuthUser },
  ): Promise<MobileBerealRoundAdminDto> {
    return this.berealService.createRound(
      eventId,
      request.user.uuid,
      dto.prompt,
      dto.durationMinutes,
    );
  }

  @Delete("bereal-rounds/:uuid")
  @HttpCode(204)
  async deleteBerealRound(
    @Param("eventId", ParseUUIDPipe) eventId: string,
    @Param("uuid", ParseUUIDPipe) uuid: string,
  ): Promise<void> {
    await this.berealService.deleteRound(eventId, uuid);
  }

  @Get("bereal-rounds/:uuid/posts")
  async listBerealPosts(
    @Param("eventId", ParseUUIDPipe) eventId: string,
    @Param("uuid", ParseUUIDPipe) uuid: string,
  ): Promise<MobileBerealPostDto[]> {
    return this.berealService.adminListPosts(eventId, uuid);
  }

  @Delete("bereal-posts/:uuid")
  @HttpCode(204)
  async deleteBerealPost(
    @Param("eventId", ParseUUIDPipe) eventId: string,
    @Param("uuid", ParseUUIDPipe) uuid: string,
  ): Promise<void> {
    await this.berealService.adminDeletePost(eventId, uuid);
  }

  // ---------------------------------------------------------------- Chat moderation

  @Get("chat/messages")
  async listChatMessages(
    @Param("eventId", ParseUUIDPipe) eventId: string,
    @Query() query: ChatMessagesQueryDto,
  ): Promise<MobileChatMessageDto[]> {
    return this.chatService.adminListMessages(eventId, query);
  }

  @Post("chat/messages")
  async sendChatMessage(
    @Param("eventId", ParseUUIDPipe) eventId: string,
    @Body() dto: SendChatMessageDto,
    @Req() request: { user: AuthUser },
  ): Promise<MobileChatMessageDto> {
    return this.chatService.adminSendMessage(
      eventId,
      request.user.uuid,
      dto.body,
    );
  }

  @Delete("chat/messages/:uuid")
  @HttpCode(204)
  async deleteChatMessage(
    @Param("eventId", ParseUUIDPipe) eventId: string,
    @Param("uuid", ParseUUIDPipe) uuid: string,
  ): Promise<void> {
    await this.chatService.adminDeleteMessage(eventId, uuid);
  }
}
