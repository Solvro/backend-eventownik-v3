/*
  Warnings:

  - You are about to drop the column `formUuid` on the `EmailTemplates` table. All the data in the column will be lost.
  - You are about to drop the column `triggerValue` on the `EmailTemplates` table. All the data in the column will be lost.
  - You are about to drop the column `triggerValue2` on the `EmailTemplates` table. All the data in the column will be lost.

*/
-- DropForeignKey
ALTER TABLE "EmailTemplates" DROP CONSTRAINT "EmailTemplates_formUuid_fkey";

-- AlterTable
ALTER TABLE "EmailTemplates" DROP COLUMN "formUuid",
DROP COLUMN "triggerValue",
DROP COLUMN "triggerValue2",
ADD COLUMN     "triggerConfig" JSONB;
