/*
  Warnings:

  - You are about to drop the `AuthAccessTokens` table. If the table is not empty, all the data it contains will be lost.
  - Made the column `eventUuid` on table `EmailTemplates` required. This step will fail if there are existing NULL values in that column.

*/
-- DropForeignKey
ALTER TABLE "AuthAccessTokens" DROP CONSTRAINT "AuthAccessTokens_tokenable_id_fkey";

-- AlterTable
ALTER TABLE "EmailTemplates" ALTER COLUMN "eventUuid" SET NOT NULL;

-- DropTable
DROP TABLE "AuthAccessTokens";

-- CreateTable
CREATE TABLE "RefreshTokens" (
    "uuid" UUID NOT NULL,
    "adminUuid" UUID NOT NULL,
    "token" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expires_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RefreshTokens_pkey" PRIMARY KEY ("uuid")
);

-- CreateIndex
CREATE UNIQUE INDEX "RefreshTokens_token_key" ON "RefreshTokens"("token");

-- CreateIndex
CREATE INDEX "RefreshTokens_adminUuid_idx" ON "RefreshTokens"("adminUuid");

-- AddForeignKey
ALTER TABLE "RefreshTokens" ADD CONSTRAINT "RefreshTokens_adminUuid_fkey" FOREIGN KEY ("adminUuid") REFERENCES "Admins"("uuid") ON DELETE CASCADE ON UPDATE CASCADE;
