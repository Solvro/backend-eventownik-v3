/*
  Warnings:

  - You are about to drop the column `formUuid` on the `Attributes` table. All the data in the column will be lost.
  - You are about to drop the column `formUuid` on the `EmailTemplates` table. All the data in the column will be lost.
  - You are about to drop the column `formUuid` on the `EventPermissions` table. All the data in the column will be lost.
  - You are about to drop the column `formUuid` on the `EventsLinks` table. All the data in the column will be lost.
  - You are about to drop the column `formUuid` on the `Participants` table. All the data in the column will be lost.
  - You are about to drop the column `formUuid` on the `PasswordResetTokens` table. All the data in the column will be lost.
  - You are about to drop the column `formUuid` on the `RefreshTokens` table. All the data in the column will be lost.

*/
-- DropForeignKey
ALTER TABLE "Attributes" DROP CONSTRAINT "Attributes_formUuid_fkey";

-- DropForeignKey
ALTER TABLE "EmailTemplates" DROP CONSTRAINT "EmailTemplates_formUuid_fkey";

-- DropForeignKey
ALTER TABLE "EventPermissions" DROP CONSTRAINT "EventPermissions_formUuid_fkey";

-- DropForeignKey
ALTER TABLE "EventsLinks" DROP CONSTRAINT "EventsLinks_formUuid_fkey";

-- DropForeignKey
ALTER TABLE "Participants" DROP CONSTRAINT "Participants_formUuid_fkey";

-- DropForeignKey
ALTER TABLE "PasswordResetTokens" DROP CONSTRAINT "PasswordResetTokens_formUuid_fkey";

-- DropForeignKey
ALTER TABLE "RefreshTokens" DROP CONSTRAINT "RefreshTokens_formUuid_fkey";

-- AlterTable
ALTER TABLE "Attributes" DROP COLUMN "formUuid";

-- AlterTable
ALTER TABLE "EmailTemplates" DROP COLUMN "formUuid";

-- AlterTable
ALTER TABLE "EventPermissions" DROP COLUMN "formUuid";

-- AlterTable
ALTER TABLE "EventsLinks" DROP COLUMN "formUuid";

-- AlterTable
ALTER TABLE "Participants" DROP COLUMN "formUuid";

-- AlterTable
ALTER TABLE "PasswordResetTokens" DROP COLUMN "formUuid";

-- AlterTable
ALTER TABLE "RefreshTokens" DROP COLUMN "formUuid";
