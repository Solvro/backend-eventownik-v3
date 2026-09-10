/*
  Warnings:

  - Made the column `dataRecipients` on table `Events` required. This step will fail if there are existing NULL values in that column.

*/
-- AlterTable
UPDATE "Events" SET "dataRecipients" = '' WHERE "dataRecipients" IS NULL;
ALTER TABLE "Events" ALTER COLUMN "dataRecipients" SET NOT NULL;
