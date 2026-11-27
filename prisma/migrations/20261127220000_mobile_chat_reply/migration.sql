-- AlterTable
ALTER TABLE "MobileChatMessages" ADD COLUMN "replyToUuid" UUID;

-- AddForeignKey
ALTER TABLE "MobileChatMessages" ADD CONSTRAINT "MobileChatMessages_replyToUuid_fkey" FOREIGN KEY ("replyToUuid") REFERENCES "MobileChatMessages"("uuid") ON DELETE SET NULL ON UPDATE CASCADE;
