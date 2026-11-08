-- CreateEnum
CREATE TYPE "OpenCondition" AS ENUM ('ON_DATE', 'MANUAL');

-- AlterTable
ALTER TABLE "Forms" ADD COLUMN     "isOpen" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "openCondition" "OpenCondition" DEFAULT 'MANUAL';
