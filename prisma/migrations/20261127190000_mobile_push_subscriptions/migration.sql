-- CreateTable
CREATE TABLE "MobilePushSubscriptions" (
    "uuid" UUID NOT NULL,
    "participantUuid" UUID NOT NULL,
    "eventUuid" UUID NOT NULL,
    "endpoint" TEXT NOT NULL,
    "p256dh" TEXT NOT NULL,
    "auth" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MobilePushSubscriptions_pkey" PRIMARY KEY ("uuid")
);

-- CreateIndex
CREATE UNIQUE INDEX "MobilePushSubscriptions_endpoint_key" ON "MobilePushSubscriptions"("endpoint");

-- CreateIndex
CREATE INDEX "MobilePushSubscriptions_participantUuid_idx" ON "MobilePushSubscriptions"("participantUuid");

-- CreateIndex
CREATE INDEX "MobilePushSubscriptions_eventUuid_idx" ON "MobilePushSubscriptions"("eventUuid");

-- AddForeignKey
ALTER TABLE "MobilePushSubscriptions" ADD CONSTRAINT "MobilePushSubscriptions_participantUuid_fkey" FOREIGN KEY ("participantUuid") REFERENCES "Participants"("uuid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MobilePushSubscriptions" ADD CONSTRAINT "MobilePushSubscriptions_eventUuid_fkey" FOREIGN KEY ("eventUuid") REFERENCES "Events"("uuid") ON DELETE CASCADE ON UPDATE CASCADE;

