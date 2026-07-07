-- DropForeignKey
ALTER TABLE "EventPermissions" DROP CONSTRAINT "EventPermissions_adminUuid_fkey";

-- DropForeignKey
ALTER TABLE "EventPermissions" DROP CONSTRAINT "EventPermissions_eventUuid_fkey";

-- AddForeignKey
ALTER TABLE "EventPermissions" ADD CONSTRAINT "EventPermissions_adminUuid_fkey" FOREIGN KEY ("adminUuid") REFERENCES "Admins"("uuid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EventPermissions" ADD CONSTRAINT "EventPermissions_eventUuid_fkey" FOREIGN KEY ("eventUuid") REFERENCES "Events"("uuid") ON DELETE CASCADE ON UPDATE CASCADE;
