-- AlterTable
ALTER TABLE "Attributes" ADD COLUMN     "formUuid" UUID;

-- AlterTable
ALTER TABLE "EmailTemplates" ADD COLUMN     "formUuid" UUID;

-- AlterTable
ALTER TABLE "EventPermissions" ADD COLUMN     "formUuid" UUID;

-- AlterTable
ALTER TABLE "EventsLinks" ADD COLUMN     "formUuid" UUID;

-- AlterTable
ALTER TABLE "Participants" ADD COLUMN     "formUuid" UUID;

-- AlterTable
ALTER TABLE "PasswordResetTokens" ADD COLUMN     "formUuid" UUID;

-- AlterTable
ALTER TABLE "RefreshTokens" ADD COLUMN     "formUuid" UUID;

-- AddForeignKey
ALTER TABLE "EventPermissions" ADD CONSTRAINT "EventPermissions_formUuid_fkey" FOREIGN KEY ("formUuid") REFERENCES "Forms"("uuid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EventsLinks" ADD CONSTRAINT "EventsLinks_formUuid_fkey" FOREIGN KEY ("formUuid") REFERENCES "Forms"("uuid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Attributes" ADD CONSTRAINT "Attributes_formUuid_fkey" FOREIGN KEY ("formUuid") REFERENCES "Forms"("uuid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmailTemplates" ADD CONSTRAINT "EmailTemplates_formUuid_fkey" FOREIGN KEY ("formUuid") REFERENCES "Forms"("uuid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Participants" ADD CONSTRAINT "Participants_formUuid_fkey" FOREIGN KEY ("formUuid") REFERENCES "Forms"("uuid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RefreshTokens" ADD CONSTRAINT "RefreshTokens_formUuid_fkey" FOREIGN KEY ("formUuid") REFERENCES "Forms"("uuid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PasswordResetTokens" ADD CONSTRAINT "PasswordResetTokens_formUuid_fkey" FOREIGN KEY ("formUuid") REFERENCES "Forms"("uuid") ON DELETE SET NULL ON UPDATE CASCADE;
