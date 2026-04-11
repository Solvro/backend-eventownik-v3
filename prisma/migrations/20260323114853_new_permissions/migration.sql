/*
  Warnings:

  - You are about to drop the `AdminsPermissions` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `Permissions` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "AdminsPermissions" DROP CONSTRAINT "AdminsPermissions_adminUuid_fkey";

-- DropForeignKey
ALTER TABLE "AdminsPermissions" DROP CONSTRAINT "AdminsPermissions_eventUuid_fkey";

-- DropForeignKey
ALTER TABLE "AdminsPermissions" DROP CONSTRAINT "AdminsPermissions_permissionUuid_fkey";

-- DropTable
DROP TABLE "AdminsPermissions";

-- DropTable
DROP TABLE "Permissions";
