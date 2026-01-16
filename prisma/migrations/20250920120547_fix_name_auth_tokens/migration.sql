/*
  Warnings:

  - You are about to drop the `AuthAcessToken` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "public"."AuthAcessToken" DROP CONSTRAINT "AuthAcessToken_tokenableId_fkey";

-- DropTable
DROP TABLE "public"."AuthAcessToken";

-- CreateTable
CREATE TABLE "public"."AuthAccessToken" (
    "id" SERIAL NOT NULL,
    "tokenableId" UUID NOT NULL,
    "type" TEXT NOT NULL,
    "name" TEXT,
    "hash" TEXT NOT NULL,
    "abilities" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "lastUsedAt" TIMESTAMP(3) NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AuthAccessToken_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AuthAccessToken_tokenableId_key" ON "public"."AuthAccessToken"("tokenableId");

-- AddForeignKey
ALTER TABLE "public"."AuthAccessToken" ADD CONSTRAINT "AuthAccessToken_tokenableId_fkey" FOREIGN KEY ("tokenableId") REFERENCES "public"."Admin"("uuid") ON DELETE RESTRICT ON UPDATE CASCADE;
