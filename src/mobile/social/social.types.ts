/** Response shapes; mirror WEB/src/types/mobile.ts field-for-field. */
import type { MobilePerson } from "../common/mobile-person";

export interface MobileChatRoomDto {
  uuid: string;
  type: "EVENT" | "DIRECT";
  title: string;
  photoUrl: string | null;
  lastMessage: {
    body: string;
    createdAt: string;
    senderName: string | null;
  } | null;
  unreadCount: number;
}

export interface MobileChatMessageDto {
  uuid: string;
  seq: number;
  body: string;
  createdAt: string;
  sender: MobilePerson | null;
  isOrganizer: boolean;
  isMine: boolean;
}

export interface MobileTinderCandidateDto extends MobilePerson {
  bio: string | null;
}

export interface MobileSwipeResultDto {
  matched: boolean;
  roomUuid: string | null;
}

export interface MobileTinderMatchDto extends MobileTinderCandidateDto {
  roomUuid: string;
  matchedAt: string;
}

export interface MobileBingoCellDto {
  taskUuid: string;
  text: string;
  completed: boolean;
  photoUrl: string | null;
  completedAt: string | null;
}

export interface MobileBingoBoardDto {
  size: number;
  cells: MobileBingoCellDto[];
  completedCount: number;
  bingoLines: number;
  hasBingo: boolean;
}

export interface MobileBingoLeaderboardEntryDto extends MobilePerson {
  completedCount: number;
}

export interface MobileBerealRoundDto {
  uuid: string;
  prompt: string | null;
  startedAt: string;
  endsAt: string;
}

export interface MobileBerealPostDto {
  uuid: string;
  photoUrl: string;
  selfieUrl: string | null;
  caption: string | null;
  isLate: boolean;
  createdAt: string;
  author: MobilePerson;
  isMine: boolean;
}

export interface MobileBerealStateDto {
  round: MobileBerealRoundDto | null;
  isActive: boolean;
  myPost: MobileBerealPostDto | null;
  canViewFeed: boolean;
}

export interface MobileBingoTaskAdminDto {
  uuid: string;
  text: string;
  order: number;
  completionsCount: number;
}

export interface MobileBerealRoundAdminDto extends MobileBerealRoundDto {
  postsCount: number;
}
