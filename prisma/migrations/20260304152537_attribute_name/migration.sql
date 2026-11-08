/*
  Warnings:

  - Made the column `name` on table `Attributes` required. This step will fail if there are existing NULL values in that column.

*/
-- AlterTable
ALTER TABLE "Attributes" ALTER COLUMN "name" SET NOT NULL;
