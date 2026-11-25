/*
  Warnings:

  - You are about to drop the column `after` on the `AuditLogs` table. All the data in the column will be lost.
  - You are about to drop the column `before` on the `AuditLogs` table. All the data in the column will be lost.
  - You are about to drop the column `triggeredBy` on the `AuditLogs` table. All the data in the column will be lost.
  - You are about to drop the `ParticipantsAttributesLogs` table. If the table is not empty, all the data it contains will be lost.
  - Added the required column `actorType` to the `AuditLogs` table without a default value. This is not possible if the table is not empty.
  - Added the required column `eventUuid` to the `AuditLogs` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "ParticipantsAttributesLogs" DROP CONSTRAINT "ParticipantsAttributesLogs_participantUuid_fkey";

-- AlterTable
ALTER TABLE "AuditLogs" DROP COLUMN "after",
DROP COLUMN "before",
DROP COLUMN "triggeredBy",
ADD COLUMN     "actorName" TEXT,
ADD COLUMN     "actorType" "LogTrigger" NOT NULL,
ADD COLUMN     "actorUuid" UUID,
ADD COLUMN     "changes" JSONB,
ADD COLUMN     "correlationId" UUID,
ADD COLUMN     "entityLabel" TEXT,
ADD COLUMN     "eventUuid" UUID NOT NULL;

-- DropTable
DROP TABLE "ParticipantsAttributesLogs";

-- CreateIndex
CREATE INDEX "AuditLogs_eventUuid_createdAt_idx" ON "AuditLogs"("eventUuid", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "AuditLogs_eventUuid_entityUuid_idx" ON "AuditLogs"("eventUuid", "entityUuid");

-- AddForeignKey
ALTER TABLE "AuditLogs" ADD CONSTRAINT "AuditLogs_eventUuid_fkey" FOREIGN KEY ("eventUuid") REFERENCES "Events"("uuid") ON DELETE CASCADE ON UPDATE CASCADE;
