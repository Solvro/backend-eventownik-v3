-- AlterTable
ALTER TABLE "MobileApps" ADD COLUMN     "soundboardEnabled" BOOLEAN NOT NULL DEFAULT true;

-- CreateTable
CREATE TABLE "MobileSoundboardPads" (
    "uuid" UUID NOT NULL,
    "eventUuid" UUID NOT NULL,
    "slot" INTEGER NOT NULL,
    "caption" TEXT NOT NULL,
    "audioKey" TEXT NOT NULL,
    "audioMime" TEXT NOT NULL,
    "durationMs" INTEGER,
    "imageKey" TEXT,
    "participantUuid" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MobileSoundboardPads_pkey" PRIMARY KEY ("uuid")
);

-- CreateIndex
CREATE INDEX "MobileSoundboardPads_participantUuid_idx" ON "MobileSoundboardPads"("participantUuid");

-- CreateIndex
CREATE UNIQUE INDEX "MobileSoundboardPads_eventUuid_slot_key" ON "MobileSoundboardPads"("eventUuid", "slot");

-- AddForeignKey
ALTER TABLE "MobileSoundboardPads" ADD CONSTRAINT "MobileSoundboardPads_eventUuid_fkey" FOREIGN KEY ("eventUuid") REFERENCES "Events"("uuid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MobileSoundboardPads" ADD CONSTRAINT "MobileSoundboardPads_participantUuid_fkey" FOREIGN KEY ("participantUuid") REFERENCES "Participants"("uuid") ON DELETE SET NULL ON UPDATE CASCADE;

