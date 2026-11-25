-- AlterTable
ALTER TABLE "Events" ADD COLUMN     "dataRecipients" TEXT;

-- CreateTable
CREATE TABLE "ParticipantsConsents" (
    "uuid" UUID NOT NULL,
    "participantUuid" UUID NOT NULL,
    "gdprConsentedAt" TIMESTAMP(3) NOT NULL,
    "termsAcceptedAt" TIMESTAMP(3) NOT NULL,
    "ip" TEXT NOT NULL,
    "userAgent" TEXT,
    "dataRecipientsSnapshot" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ParticipantsConsents_pkey" PRIMARY KEY ("uuid")
);

-- CreateIndex
CREATE UNIQUE INDEX "ParticipantsConsents_participantUuid_key" ON "ParticipantsConsents"("participantUuid");

-- AddForeignKey
ALTER TABLE "ParticipantsConsents" ADD CONSTRAINT "ParticipantsConsents_participantUuid_fkey" FOREIGN KEY ("participantUuid") REFERENCES "Participants"("uuid") ON DELETE CASCADE ON UPDATE CASCADE;
