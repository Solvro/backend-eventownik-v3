/*
  Warnings:

  - Changed the type of `triggeredBy` on the `ParticipantsAttributesLogs` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.

*/
-- CreateEnum
CREATE TYPE "LogTrigger" AS ENUM ('ADMIN', 'PARTICIPANT', 'SYSTEM');

-- AlterTable
ALTER TABLE "ParticipantsAttributesLogs" DROP COLUMN "triggeredBy",
ADD COLUMN     "triggeredBy" "LogTrigger" NOT NULL;
