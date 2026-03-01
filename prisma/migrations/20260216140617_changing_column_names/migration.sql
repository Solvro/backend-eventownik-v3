/*
  Warnings:

  - You are about to drop the `Emails` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `ParticipantsEmails` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `ParticipantsForms` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "Emails" DROP CONSTRAINT "Emails_eventUuid_fkey";

-- DropForeignKey
ALTER TABLE "Emails" DROP CONSTRAINT "Emails_formUuid_fkey";

-- DropForeignKey
ALTER TABLE "ParticipantsEmails" DROP CONSTRAINT "ParticipantsEmails_emailUuid_fkey";

-- DropForeignKey
ALTER TABLE "ParticipantsEmails" DROP CONSTRAINT "ParticipantsEmails_participantUuid_fkey";

-- DropForeignKey
ALTER TABLE "ParticipantsForms" DROP CONSTRAINT "ParticipantsForms_emailUuid_fkey";

-- DropForeignKey
ALTER TABLE "ParticipantsForms" DROP CONSTRAINT "ParticipantsForms_formUuid_fkey";

-- DropForeignKey
ALTER TABLE "ParticipantsForms" DROP CONSTRAINT "ParticipantsForms_participantUuid_fkey";

-- DropTable
DROP TABLE "Emails";

-- DropTable
DROP TABLE "ParticipantsEmails";

-- DropTable
DROP TABLE "ParticipantsForms";

-- CreateTable
CREATE TABLE "EmailTemplates" (
    "uuid" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "trigger" "EmailTrigger" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "triggerValue" TEXT,
    "triggerValue2" TEXT,
    "eventUuid" UUID,
    "formUuid" UUID,

    CONSTRAINT "EmailTemplates_pkey" PRIMARY KEY ("uuid")
);

-- CreateTable
CREATE TABLE "ParticipantsEmailStatuses" (
    "uuid" UUID NOT NULL,
    "status" "EmailStatus" NOT NULL,
    "sendAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "sendBy" TEXT,
    "participantUuid" UUID,
    "emailUuid" UUID,

    CONSTRAINT "ParticipantsEmailStatuses_pkey" PRIMARY KEY ("uuid")
);

-- CreateTable
CREATE TABLE "ParticipantsFormLogs" (
    "uuid" UUID NOT NULL,
    "participantUuid" UUID NOT NULL,
    "formUuid" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "lastOpenedAt" TIMESTAMP(3),
    "lastSubmittedAt" TIMESTAMP(3),
    "emailUuid" UUID,

    CONSTRAINT "ParticipantsFormLogs_pkey" PRIMARY KEY ("uuid")
);

-- AddForeignKey
ALTER TABLE "EmailTemplates" ADD CONSTRAINT "EmailTemplates_eventUuid_fkey" FOREIGN KEY ("eventUuid") REFERENCES "Events"("uuid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmailTemplates" ADD CONSTRAINT "EmailTemplates_formUuid_fkey" FOREIGN KEY ("formUuid") REFERENCES "Forms"("uuid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ParticipantsEmailStatuses" ADD CONSTRAINT "ParticipantsEmailStatuses_participantUuid_fkey" FOREIGN KEY ("participantUuid") REFERENCES "Participants"("uuid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ParticipantsEmailStatuses" ADD CONSTRAINT "ParticipantsEmailStatuses_emailUuid_fkey" FOREIGN KEY ("emailUuid") REFERENCES "EmailTemplates"("uuid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ParticipantsFormLogs" ADD CONSTRAINT "ParticipantsFormLogs_participantUuid_fkey" FOREIGN KEY ("participantUuid") REFERENCES "Participants"("uuid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ParticipantsFormLogs" ADD CONSTRAINT "ParticipantsFormLogs_formUuid_fkey" FOREIGN KEY ("formUuid") REFERENCES "Forms"("uuid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ParticipantsFormLogs" ADD CONSTRAINT "ParticipantsFormLogs_emailUuid_fkey" FOREIGN KEY ("emailUuid") REFERENCES "EmailTemplates"("uuid") ON DELETE SET NULL ON UPDATE CASCADE;
