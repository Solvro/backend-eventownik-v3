/*
  Warnings:

  - Made the column `eventUuid` on table `EmailTemplates` required. This step will fail if there are existing NULL values in that column.

*/
-- AlterTable
ALTER TABLE "EmailTemplates" ALTER COLUMN "eventUuid" SET NOT NULL;
