/*
  Warnings:

  - Made the column `name` on table `Blocks` required. This step will fail if there are existing NULL values in that column.

*/
-- AlterTable
ALTER TABLE "Blocks" ADD COLUMN     "isRootBlock" BOOLEAN NOT NULL DEFAULT false,
ALTER COLUMN "name" SET NOT NULL;
