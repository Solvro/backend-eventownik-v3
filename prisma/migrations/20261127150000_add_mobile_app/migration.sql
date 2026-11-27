-- CreateEnum
CREATE TYPE "MobileChatRoomType" AS ENUM ('EVENT', 'DIRECT');

-- CreateTable
CREATE TABLE "MobileApps" (
    "uuid" UUID NOT NULL,
    "eventUuid" UUID NOT NULL,
    "isEnabled" BOOLEAN NOT NULL DEFAULT false,
    "welcomeMessage" TEXT,
    "sosEnabled" BOOLEAN NOT NULL DEFAULT true,
    "scheduleEnabled" BOOLEAN NOT NULL DEFAULT true,
    "chatEnabled" BOOLEAN NOT NULL DEFAULT true,
    "tinderEnabled" BOOLEAN NOT NULL DEFAULT true,
    "bingoEnabled" BOOLEAN NOT NULL DEFAULT true,
    "berealEnabled" BOOLEAN NOT NULL DEFAULT true,
    "bingoSize" INTEGER NOT NULL DEFAULT 4,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MobileApps_pkey" PRIMARY KEY ("uuid")
);

-- CreateTable
CREATE TABLE "MobileSosContacts" (
    "uuid" UUID NOT NULL,
    "eventUuid" UUID NOT NULL,
    "label" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "description" TEXT,
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MobileSosContacts_pkey" PRIMARY KEY ("uuid")
);

-- CreateTable
CREATE TABLE "MobileFaqItems" (
    "uuid" UUID NOT NULL,
    "eventUuid" UUID NOT NULL,
    "question" TEXT NOT NULL,
    "answer" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MobileFaqItems_pkey" PRIMARY KEY ("uuid")
);

-- CreateTable
CREATE TABLE "MobileScheduleItems" (
    "uuid" UUID NOT NULL,
    "eventUuid" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "location" TEXT,
    "startsAt" TIMESTAMP(3) NOT NULL,
    "endsAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MobileScheduleItems_pkey" PRIMARY KEY ("uuid")
);

-- CreateTable
CREATE TABLE "MobileNotifications" (
    "uuid" UUID NOT NULL,
    "seq" SERIAL NOT NULL,
    "eventUuid" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "createdByAdminUuid" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MobileNotifications_pkey" PRIMARY KEY ("uuid")
);

-- CreateTable
CREATE TABLE "MobileProfiles" (
    "uuid" UUID NOT NULL,
    "participantUuid" UUID NOT NULL,
    "eventUuid" UUID NOT NULL,
    "displayName" TEXT NOT NULL,
    "bio" TEXT,
    "photoKey" TEXT,
    "tinderOptIn" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MobileProfiles_pkey" PRIMARY KEY ("uuid")
);

-- CreateTable
CREATE TABLE "MobileOtpCodes" (
    "uuid" UUID NOT NULL,
    "participantUuid" UUID NOT NULL,
    "codeHash" TEXT NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "consumedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MobileOtpCodes_pkey" PRIMARY KEY ("uuid")
);

-- CreateTable
CREATE TABLE "MobileChatRooms" (
    "uuid" UUID NOT NULL,
    "eventUuid" UUID NOT NULL,
    "type" "MobileChatRoomType" NOT NULL,
    "key" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MobileChatRooms_pkey" PRIMARY KEY ("uuid")
);

-- CreateTable
CREATE TABLE "MobileChatMembers" (
    "uuid" UUID NOT NULL,
    "roomUuid" UUID NOT NULL,
    "participantUuid" UUID NOT NULL,
    "lastReadSeq" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MobileChatMembers_pkey" PRIMARY KEY ("uuid")
);

-- CreateTable
CREATE TABLE "MobileChatMessages" (
    "uuid" UUID NOT NULL,
    "seq" SERIAL NOT NULL,
    "roomUuid" UUID NOT NULL,
    "senderParticipantUuid" UUID,
    "senderAdminUuid" UUID,
    "body" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "MobileChatMessages_pkey" PRIMARY KEY ("uuid")
);

-- CreateTable
CREATE TABLE "MobileSwipes" (
    "uuid" UUID NOT NULL,
    "eventUuid" UUID NOT NULL,
    "fromParticipantUuid" UUID NOT NULL,
    "toParticipantUuid" UUID NOT NULL,
    "liked" BOOLEAN NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MobileSwipes_pkey" PRIMARY KEY ("uuid")
);

-- CreateTable
CREATE TABLE "MobileBingoTasks" (
    "uuid" UUID NOT NULL,
    "eventUuid" UUID NOT NULL,
    "text" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MobileBingoTasks_pkey" PRIMARY KEY ("uuid")
);

-- CreateTable
CREATE TABLE "MobileBingoCompletions" (
    "uuid" UUID NOT NULL,
    "taskUuid" UUID NOT NULL,
    "participantUuid" UUID NOT NULL,
    "photoKey" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MobileBingoCompletions_pkey" PRIMARY KEY ("uuid")
);

-- CreateTable
CREATE TABLE "MobileBerealRounds" (
    "uuid" UUID NOT NULL,
    "eventUuid" UUID NOT NULL,
    "prompt" TEXT,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endsAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MobileBerealRounds_pkey" PRIMARY KEY ("uuid")
);

-- CreateTable
CREATE TABLE "MobileBerealPosts" (
    "uuid" UUID NOT NULL,
    "roundUuid" UUID NOT NULL,
    "participantUuid" UUID NOT NULL,
    "photoKey" TEXT NOT NULL,
    "selfieKey" TEXT,
    "caption" TEXT,
    "isLate" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MobileBerealPosts_pkey" PRIMARY KEY ("uuid")
);

-- CreateIndex
CREATE UNIQUE INDEX "MobileApps_eventUuid_key" ON "MobileApps"("eventUuid");

-- CreateIndex
CREATE INDEX "MobileSosContacts_eventUuid_idx" ON "MobileSosContacts"("eventUuid");

-- CreateIndex
CREATE INDEX "MobileFaqItems_eventUuid_idx" ON "MobileFaqItems"("eventUuid");

-- CreateIndex
CREATE INDEX "MobileScheduleItems_eventUuid_startsAt_idx" ON "MobileScheduleItems"("eventUuid", "startsAt");

-- CreateIndex
CREATE UNIQUE INDEX "MobileNotifications_seq_key" ON "MobileNotifications"("seq");

-- CreateIndex
CREATE INDEX "MobileNotifications_eventUuid_seq_idx" ON "MobileNotifications"("eventUuid", "seq");

-- CreateIndex
CREATE UNIQUE INDEX "MobileProfiles_participantUuid_key" ON "MobileProfiles"("participantUuid");

-- CreateIndex
CREATE INDEX "MobileProfiles_eventUuid_idx" ON "MobileProfiles"("eventUuid");

-- CreateIndex
CREATE INDEX "MobileOtpCodes_participantUuid_createdAt_idx" ON "MobileOtpCodes"("participantUuid", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "MobileChatRooms_eventUuid_key_key" ON "MobileChatRooms"("eventUuid", "key");

-- CreateIndex
CREATE INDEX "MobileChatMembers_participantUuid_idx" ON "MobileChatMembers"("participantUuid");

-- CreateIndex
CREATE UNIQUE INDEX "MobileChatMembers_roomUuid_participantUuid_key" ON "MobileChatMembers"("roomUuid", "participantUuid");

-- CreateIndex
CREATE UNIQUE INDEX "MobileChatMessages_seq_key" ON "MobileChatMessages"("seq");

-- CreateIndex
CREATE INDEX "MobileChatMessages_roomUuid_seq_idx" ON "MobileChatMessages"("roomUuid", "seq");

-- CreateIndex
CREATE INDEX "MobileSwipes_toParticipantUuid_liked_idx" ON "MobileSwipes"("toParticipantUuid", "liked");

-- CreateIndex
CREATE INDEX "MobileSwipes_eventUuid_idx" ON "MobileSwipes"("eventUuid");

-- CreateIndex
CREATE UNIQUE INDEX "MobileSwipes_fromParticipantUuid_toParticipantUuid_key" ON "MobileSwipes"("fromParticipantUuid", "toParticipantUuid");

-- CreateIndex
CREATE INDEX "MobileBingoTasks_eventUuid_idx" ON "MobileBingoTasks"("eventUuid");

-- CreateIndex
CREATE INDEX "MobileBingoCompletions_participantUuid_idx" ON "MobileBingoCompletions"("participantUuid");

-- CreateIndex
CREATE UNIQUE INDEX "MobileBingoCompletions_taskUuid_participantUuid_key" ON "MobileBingoCompletions"("taskUuid", "participantUuid");

-- CreateIndex
CREATE INDEX "MobileBerealRounds_eventUuid_startedAt_idx" ON "MobileBerealRounds"("eventUuid", "startedAt");

-- CreateIndex
CREATE INDEX "MobileBerealPosts_participantUuid_idx" ON "MobileBerealPosts"("participantUuid");

-- CreateIndex
CREATE UNIQUE INDEX "MobileBerealPosts_roundUuid_participantUuid_key" ON "MobileBerealPosts"("roundUuid", "participantUuid");

-- AddForeignKey
ALTER TABLE "MobileApps" ADD CONSTRAINT "MobileApps_eventUuid_fkey" FOREIGN KEY ("eventUuid") REFERENCES "Events"("uuid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MobileSosContacts" ADD CONSTRAINT "MobileSosContacts_eventUuid_fkey" FOREIGN KEY ("eventUuid") REFERENCES "Events"("uuid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MobileFaqItems" ADD CONSTRAINT "MobileFaqItems_eventUuid_fkey" FOREIGN KEY ("eventUuid") REFERENCES "Events"("uuid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MobileScheduleItems" ADD CONSTRAINT "MobileScheduleItems_eventUuid_fkey" FOREIGN KEY ("eventUuid") REFERENCES "Events"("uuid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MobileNotifications" ADD CONSTRAINT "MobileNotifications_eventUuid_fkey" FOREIGN KEY ("eventUuid") REFERENCES "Events"("uuid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MobileProfiles" ADD CONSTRAINT "MobileProfiles_participantUuid_fkey" FOREIGN KEY ("participantUuid") REFERENCES "Participants"("uuid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MobileProfiles" ADD CONSTRAINT "MobileProfiles_eventUuid_fkey" FOREIGN KEY ("eventUuid") REFERENCES "Events"("uuid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MobileOtpCodes" ADD CONSTRAINT "MobileOtpCodes_participantUuid_fkey" FOREIGN KEY ("participantUuid") REFERENCES "Participants"("uuid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MobileChatRooms" ADD CONSTRAINT "MobileChatRooms_eventUuid_fkey" FOREIGN KEY ("eventUuid") REFERENCES "Events"("uuid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MobileChatMembers" ADD CONSTRAINT "MobileChatMembers_roomUuid_fkey" FOREIGN KEY ("roomUuid") REFERENCES "MobileChatRooms"("uuid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MobileChatMembers" ADD CONSTRAINT "MobileChatMembers_participantUuid_fkey" FOREIGN KEY ("participantUuid") REFERENCES "Participants"("uuid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MobileChatMessages" ADD CONSTRAINT "MobileChatMessages_roomUuid_fkey" FOREIGN KEY ("roomUuid") REFERENCES "MobileChatRooms"("uuid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MobileChatMessages" ADD CONSTRAINT "MobileChatMessages_senderParticipantUuid_fkey" FOREIGN KEY ("senderParticipantUuid") REFERENCES "Participants"("uuid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MobileSwipes" ADD CONSTRAINT "MobileSwipes_eventUuid_fkey" FOREIGN KEY ("eventUuid") REFERENCES "Events"("uuid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MobileSwipes" ADD CONSTRAINT "MobileSwipes_fromParticipantUuid_fkey" FOREIGN KEY ("fromParticipantUuid") REFERENCES "Participants"("uuid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MobileSwipes" ADD CONSTRAINT "MobileSwipes_toParticipantUuid_fkey" FOREIGN KEY ("toParticipantUuid") REFERENCES "Participants"("uuid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MobileBingoTasks" ADD CONSTRAINT "MobileBingoTasks_eventUuid_fkey" FOREIGN KEY ("eventUuid") REFERENCES "Events"("uuid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MobileBingoCompletions" ADD CONSTRAINT "MobileBingoCompletions_taskUuid_fkey" FOREIGN KEY ("taskUuid") REFERENCES "MobileBingoTasks"("uuid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MobileBingoCompletions" ADD CONSTRAINT "MobileBingoCompletions_participantUuid_fkey" FOREIGN KEY ("participantUuid") REFERENCES "Participants"("uuid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MobileBerealRounds" ADD CONSTRAINT "MobileBerealRounds_eventUuid_fkey" FOREIGN KEY ("eventUuid") REFERENCES "Events"("uuid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MobileBerealPosts" ADD CONSTRAINT "MobileBerealPosts_roundUuid_fkey" FOREIGN KEY ("roundUuid") REFERENCES "MobileBerealRounds"("uuid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MobileBerealPosts" ADD CONSTRAINT "MobileBerealPosts_participantUuid_fkey" FOREIGN KEY ("participantUuid") REFERENCES "Participants"("uuid") ON DELETE CASCADE ON UPDATE CASCADE;

