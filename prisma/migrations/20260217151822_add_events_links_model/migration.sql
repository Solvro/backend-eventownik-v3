/*
  Warnings:

  - You are about to drop the column `links` on the `Events` table. All the data in the column will be lost.
  - You are about to drop the column `policyLinks` on the `Events` table. All the data in the column will be lost.

*/
-- CreateEnum
CREATE TYPE "EventLinkType" AS ENUM ('general', 'policy');

-- AlterTable
ALTER TABLE "Events" DROP COLUMN "links",
DROP COLUMN "policyLinks";

-- CreateTable
CREATE TABLE "EventsLinks" (
    "uuid" UUID NOT NULL,
    "eventUuid" UUID NOT NULL,
    "url" TEXT NOT NULL,
    "type" "EventLinkType" NOT NULL,
    "label" TEXT,

    CONSTRAINT "EventsLinks_pkey" PRIMARY KEY ("uuid")
);

-- AddForeignKey
ALTER TABLE "EventsLinks" ADD CONSTRAINT "EventsLinks_eventUuid_fkey" FOREIGN KEY ("eventUuid") REFERENCES "Events"("uuid") ON DELETE CASCADE ON UPDATE CASCADE;
