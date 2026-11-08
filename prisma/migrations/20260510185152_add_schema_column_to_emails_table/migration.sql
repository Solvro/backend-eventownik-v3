/*
  Warnings:

  - Made the column `eventUuid` on table `EmailTemplates` required. This step will fail if there are existing NULL values in that column.

*/
-- AlterTable
ALTER TABLE "EmailTemplates" ADD COLUMN     "schema" JSONB,
ALTER COLUMN "eventUuid" SET NOT NULL;
