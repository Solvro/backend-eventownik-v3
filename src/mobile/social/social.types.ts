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
  /** Text the participant added when completing the task */
  note: string | null;
  completedAt: string | null;
}

export interface MobileBingoBoardDto {
  size: number;
  cells: MobileBingoCellDto[];
  completedCount: number;
  bingoLines: number;
  hasBingo: boolean;
  /** When the organizer limits bingo to a time window; null = no limit on that side */
  startsAt: string | null;
  endsAt: string | null;
  /** Tasks can be ticked only while "active" */
  status: MobileBingoStatus;
}

export type MobileBingoStatus = "upcoming" | "active" | "ended";

export interface MobileBingoLeaderboardEntryDto extends MobilePerson {
  completedCount: number;
  /** When the participant ticked their latest task: breaks ties in the ranking */
  lastCompletedAt: string;
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

/** One ticked task, as organizers see it */
export interface MobileBingoCompletionAdminDto {
  uuid: string;
  taskUuid: string;
  taskText: string;
  participant: MobilePerson & { email: string };
  photoUrl: string | null;
  note: string | null;
  completedAt: string;
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
