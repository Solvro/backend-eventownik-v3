-- CreateEnum
CREATE TYPE "TicketMode" AS ENUM ('EVENT', 'BLOCK');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "PermissionType" ADD VALUE 'MANAGE_TICKET';
ALTER TYPE "PermissionType" ADD VALUE 'SCAN_TICKET';

-- AlterTable
ALTER TABLE "Participants" ADD COLUMN     "ticketToken" TEXT NOT NULL DEFAULT replace((gen_random_uuid())::text || (gen_random_uuid())::text, '-', '');

-- CreateTable
CREATE TABLE "Tickets" (
    "uuid" UUID NOT NULL,
    "eventUuid" UUID NOT NULL,
    "attributeUuid" UUID,
    "mode" "TicketMode" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Tickets_pkey" PRIMARY KEY ("uuid")
);

-- CreateTable
CREATE TABLE "TicketAttributes" (
    "uuid" UUID NOT NULL,
    "ticketUuid" UUID NOT NULL,
    "attributeUuid" UUID NOT NULL,

    CONSTRAINT "TicketAttributes_pkey" PRIMARY KEY ("uuid")
);

-- CreateTable
CREATE TABLE "TicketCheckIns" (
    "uuid" UUID NOT NULL,
    "ticketUuid" UUID NOT NULL,
    "participantUuid" UUID NOT NULL,
    "blockUuid" UUID,
    "confirmedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "confirmedByAdminUuid" UUID,

    CONSTRAINT "TicketCheckIns_pkey" PRIMARY KEY ("uuid")
);

-- CreateIndex
CREATE UNIQUE INDEX "Tickets_attributeUuid_key" ON "Tickets"("attributeUuid");

-- CreateIndex
CREATE INDEX "Tickets_eventUuid_idx" ON "Tickets"("eventUuid");

-- CreateIndex
CREATE UNIQUE INDEX "TicketAttributes_ticketUuid_attributeUuid_key" ON "TicketAttributes"("ticketUuid", "attributeUuid");

-- CreateIndex
CREATE INDEX "TicketCheckIns_participantUuid_idx" ON "TicketCheckIns"("participantUuid");

-- CreateIndex
CREATE UNIQUE INDEX "Participants_ticketToken_key" ON "Participants"("ticketToken");

-- AddForeignKey
ALTER TABLE "Tickets" ADD CONSTRAINT "Tickets_eventUuid_fkey" FOREIGN KEY ("eventUuid") REFERENCES "Events"("uuid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Tickets" ADD CONSTRAINT "Tickets_attributeUuid_fkey" FOREIGN KEY ("attributeUuid") REFERENCES "Attributes"("uuid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TicketAttributes" ADD CONSTRAINT "TicketAttributes_ticketUuid_fkey" FOREIGN KEY ("ticketUuid") REFERENCES "Tickets"("uuid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TicketAttributes" ADD CONSTRAINT "TicketAttributes_attributeUuid_fkey" FOREIGN KEY ("attributeUuid") REFERENCES "Attributes"("uuid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TicketCheckIns" ADD CONSTRAINT "TicketCheckIns_ticketUuid_fkey" FOREIGN KEY ("ticketUuid") REFERENCES "Tickets"("uuid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TicketCheckIns" ADD CONSTRAINT "TicketCheckIns_participantUuid_fkey" FOREIGN KEY ("participantUuid") REFERENCES "Participants"("uuid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TicketCheckIns" ADD CONSTRAINT "TicketCheckIns_blockUuid_fkey" FOREIGN KEY ("blockUuid") REFERENCES "Blocks"("uuid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TicketCheckIns" ADD CONSTRAINT "TicketCheckIns_confirmedByAdminUuid_fkey" FOREIGN KEY ("confirmedByAdminUuid") REFERENCES "Admins"("uuid") ON DELETE SET NULL ON UPDATE CASCADE;


ALTER TABLE "Tickets" ADD CONSTRAINT "Tickets_mode_attribute_check" CHECK (
    ("mode" = 'EVENT' AND "attributeUuid" IS NULL)
    OR ("mode" = 'BLOCK' AND "attributeUuid" IS NOT NULL)
);

CREATE UNIQUE INDEX "Tickets_eventUuid_event_mode_key" ON "Tickets"("eventUuid") WHERE "mode" = 'EVENT';

CREATE UNIQUE INDEX "TicketCheckIns_ticketUuid_participantUuid_blockUuid_key"
    ON "TicketCheckIns"("ticketUuid", "participantUuid", "blockUuid") NULLS NOT DISTINCT;
