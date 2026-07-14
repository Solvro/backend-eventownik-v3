/*
  Warnings:

  - You are about to drop the column `photoUrl` on the `Events` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "Events" DROP COLUMN "photoUrl",
ADD COLUMN     "photoKey" TEXT;
