/*
  Warnings:

  - The `before` column on the `ParticipantsAttributesLogs` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - The `after` column on the `ParticipantsAttributesLogs` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - A unique constraint covering the columns `[participantUuid,formUuid]` on the table `ParticipantsFormLogs` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "ParticipantsAttributesLogs" DROP COLUMN "before",
ADD COLUMN     "before" JSONB,
DROP COLUMN "after",
ADD COLUMN     "after" JSONB;

-- CreateIndex
CREATE UNIQUE INDEX "ParticipantsFormLogs_participantUuid_formUuid_key" ON "ParticipantsFormLogs"("participantUuid", "formUuid");
