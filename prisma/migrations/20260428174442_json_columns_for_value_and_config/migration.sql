/*
  Warnings:

  - You are about to drop the column `options` on the `Attributes` table. All the data in the column will be lost.
  - The `value` column on the `ParticipantsAttributes` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - A unique constraint covering the columns `[participantUuid,attributeUuid]` on the table `ParticipantsAttributes` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterEnum
ALTER TYPE "AttributeType" ADD VALUE 'drawing';

-- AlterTable
ALTER TABLE "Attributes" DROP COLUMN "options",
ADD COLUMN     "config" JSONB DEFAULT '{}';

-- AlterTable
ALTER TABLE "ParticipantsAttributes" DROP COLUMN "value",
ADD COLUMN     "value" JSONB;

-- CreateIndex
CREATE UNIQUE INDEX "ParticipantsAttributes_participantUuid_attributeUuid_key" ON "ParticipantsAttributes"("participantUuid", "attributeUuid");
