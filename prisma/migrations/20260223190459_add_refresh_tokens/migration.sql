/*
  Warnings:

  - You are about to drop the column `hash` on the `AuthAccessTokens` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[token]` on the table `AuthAccessTokens` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `token` to the `AuthAccessTokens` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "PermissionType" AS ENUM ('MANAGE_ALL', 'MANAGE_EVENT', 'MANAGE_FORM', 'MANAGE_PARTICIPANT', 'MANAGE_EMAIL');

-- DropIndex
DROP INDEX "AuthAccessTokens_tokenable_id_key";

-- AlterTable
ALTER TABLE "AuthAccessTokens" DROP COLUMN "hash",
ADD COLUMN     "token" TEXT NOT NULL,
ALTER COLUMN "last_used_at" DROP NOT NULL;

-- CreateTable
CREATE TABLE "EventPermissions" (
    "uuid" UUID NOT NULL,
    "eventUuid" UUID NOT NULL,
    "adminUuid" UUID NOT NULL,
    "permission" "PermissionType" NOT NULL,

    CONSTRAINT "EventPermissions_pkey" PRIMARY KEY ("uuid")
);

-- CreateIndex
CREATE UNIQUE INDEX "EventPermissions_eventUuid_adminUuid_permission_key" ON "EventPermissions"("eventUuid", "adminUuid", "permission");

-- CreateIndex
CREATE UNIQUE INDEX "AuthAccessTokens_token_key" ON "AuthAccessTokens"("token");

-- AddForeignKey
ALTER TABLE "EventPermissions" ADD CONSTRAINT "EventPermissions_adminUuid_fkey" FOREIGN KEY ("adminUuid") REFERENCES "Admins"("uuid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EventPermissions" ADD CONSTRAINT "EventPermissions_eventUuid_fkey" FOREIGN KEY ("eventUuid") REFERENCES "Events"("uuid") ON DELETE RESTRICT ON UPDATE CASCADE;
