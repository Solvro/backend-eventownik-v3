/*
  Warnings:

  - Made the column `openCondition` on table `Forms` required. This step will fail if there are existing NULL values in that column.

*/
-- AlterTable
ALTER TABLE "Forms" ALTER COLUMN "openCondition" SET NOT NULL;
