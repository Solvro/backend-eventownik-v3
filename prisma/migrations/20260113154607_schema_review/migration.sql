/*
  Warnings:

  - You are about to drop the `Admin` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `AdminPermission` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `Attribute` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `Block` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `Email` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `Event` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `Form` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `FormDefinition` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `Participant` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `ParticipantAttribute` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `ParticipantAttributeLog` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `ParticipantEmail` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `ParticipantForm` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `Permission` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "AdminPermission" DROP CONSTRAINT "AdminPermission_adminUuid_fkey";

-- DropForeignKey
ALTER TABLE "AdminPermission" DROP CONSTRAINT "AdminPermission_eventUuid_fkey";

-- DropForeignKey
ALTER TABLE "AdminPermission" DROP CONSTRAINT "AdminPermission_permissionUuid_fkey";

-- DropForeignKey
ALTER TABLE "Attribute" DROP CONSTRAINT "Attribute_eventUuid_fkey";

-- DropForeignKey
ALTER TABLE "Block" DROP CONSTRAINT "Block_attributeUuid_fkey";

-- DropForeignKey
ALTER TABLE "Block" DROP CONSTRAINT "Block_parentUuid_fkey";

-- DropForeignKey
ALTER TABLE "Email" DROP CONSTRAINT "Email_eventUuid_fkey";

-- DropForeignKey
ALTER TABLE "Email" DROP CONSTRAINT "Email_formUuid_fkey";

-- DropForeignKey
ALTER TABLE "Event" DROP CONSTRAINT "Event_organizerUuid_fkey";

-- DropForeignKey
ALTER TABLE "Event" DROP CONSTRAINT "Event_registerFormUuid_fkey";

-- DropForeignKey
ALTER TABLE "Form" DROP CONSTRAINT "Form_eventUuid_fkey";

-- DropForeignKey
ALTER TABLE "FormDefinition" DROP CONSTRAINT "FormDefinition_attributeUuid_fkey";

-- DropForeignKey
ALTER TABLE "FormDefinition" DROP CONSTRAINT "FormDefinition_formUuid_fkey";

-- DropForeignKey
ALTER TABLE "Participant" DROP CONSTRAINT "Participant_eventUuid_fkey";

-- DropForeignKey
ALTER TABLE "ParticipantAttribute" DROP CONSTRAINT "ParticipantAttribute_attributeUuid_fkey";

-- DropForeignKey
ALTER TABLE "ParticipantAttribute" DROP CONSTRAINT "ParticipantAttribute_participantUuid_fkey";

-- DropForeignKey
ALTER TABLE "ParticipantAttributeLog" DROP CONSTRAINT "ParticipantAttributeLog_participantUuid_fkey";

-- DropForeignKey
ALTER TABLE "ParticipantEmail" DROP CONSTRAINT "ParticipantEmail_emailUuid_fkey";

-- DropForeignKey
ALTER TABLE "ParticipantEmail" DROP CONSTRAINT "ParticipantEmail_participantUuid_fkey";

-- DropForeignKey
ALTER TABLE "ParticipantForm" DROP CONSTRAINT "ParticipantForm_emailUuid_fkey";

-- DropForeignKey
ALTER TABLE "ParticipantForm" DROP CONSTRAINT "ParticipantForm_formUuid_fkey";

-- DropForeignKey
ALTER TABLE "ParticipantForm" DROP CONSTRAINT "ParticipantForm_participantUuid_fkey";

-- DropTable
DROP TABLE "Admin";

-- DropTable
DROP TABLE "AdminPermission";

-- DropTable
DROP TABLE "Attribute";

-- DropTable
DROP TABLE "Block";

-- DropTable
DROP TABLE "Email";

-- DropTable
DROP TABLE "Event";

-- DropTable
DROP TABLE "Form";

-- DropTable
DROP TABLE "FormDefinition";

-- DropTable
DROP TABLE "Participant";

-- DropTable
DROP TABLE "ParticipantAttribute";

-- DropTable
DROP TABLE "ParticipantAttributeLog";

-- DropTable
DROP TABLE "ParticipantEmail";

-- DropTable
DROP TABLE "ParticipantForm";

-- DropTable
DROP TABLE "Permission";

-- CreateTable
CREATE TABLE "Admins" (
    "uuid" UUID NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "type" "OrganizerType" NOT NULL DEFAULT 'organizer',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Admins_pkey" PRIMARY KEY ("uuid")
);

-- CreateTable
CREATE TABLE "AdminsPermissions" (
    "uuid" UUID NOT NULL,
    "eventUuid" UUID NOT NULL,
    "permissionUuid" UUID NOT NULL,
    "adminUuid" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AdminsPermissions_pkey" PRIMARY KEY ("uuid")
);

-- CreateTable
CREATE TABLE "Permissions" (
    "uuid" UUID NOT NULL,
    "action" TEXT NOT NULL,
    "subject" TEXT NOT NULL,

    CONSTRAINT "Permissions_pkey" PRIMARY KEY ("uuid")
);

-- CreateTable
CREATE TABLE "Events" (
    "uuid" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "links" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "policyLinks" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "participantsLimit" INTEGER,
    "verifiedAt" TIMESTAMP(3),
    "description" TEXT,
    "primaryColor" TEXT,
    "organizerName" TEXT,
    "photoUrl" TEXT,
    "location" TEXT,
    "contactEmail" TEXT,
    "slug" TEXT,
    "organizerUuid" UUID,
    "registerFormUuid" UUID,

    CONSTRAINT "Events_pkey" PRIMARY KEY ("uuid")
);

-- CreateTable
CREATE TABLE "Attributes" (
    "uuid" UUID NOT NULL,
    "eventUuid" UUID NOT NULL,
    "type" "AttributeType" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "showInList" BOOLEAN NOT NULL DEFAULT true,
    "order" INTEGER NOT NULL,
    "options" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "name" TEXT,

    CONSTRAINT "Attributes_pkey" PRIMARY KEY ("uuid")
);

-- CreateTable
CREATE TABLE "Blocks" (
    "uuid" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "capacity" INTEGER,
    "order" INTEGER,
    "name" TEXT,
    "description" TEXT,
    "parentUuid" UUID,
    "attributeUuid" UUID,

    CONSTRAINT "Blocks_pkey" PRIMARY KEY ("uuid")
);

-- CreateTable
CREATE TABLE "Emails" (
    "uuid" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "trigger" "EmailTrigger" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "triggerValue" TEXT,
    "triggerValue2" TEXT,
    "eventUuid" UUID,
    "formUuid" UUID,

    CONSTRAINT "Emails_pkey" PRIMARY KEY ("uuid")
);

-- CreateTable
CREATE TABLE "Forms" (
    "uuid" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "isEditable" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "openDate" TIMESTAMP(3),
    "closeDate" TIMESTAMP(3),
    "description" TEXT,
    "eventUuid" UUID,

    CONSTRAINT "Forms_pkey" PRIMARY KEY ("uuid")
);

-- CreateTable
CREATE TABLE "FormsDefinitions" (
    "uuid" UUID NOT NULL,
    "isRequired" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "order" INTEGER,
    "attributeUuid" UUID,
    "formUuid" UUID,

    CONSTRAINT "FormsDefinitions_pkey" PRIMARY KEY ("uuid")
);

-- CreateTable
CREATE TABLE "Participants" (
    "uuid" UUID NOT NULL,
    "email" TEXT NOT NULL,
    "eventUuid" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Participants_pkey" PRIMARY KEY ("uuid")
);

-- CreateTable
CREATE TABLE "ParticipantsAttributes" (
    "uuid" UUID NOT NULL,
    "participantUuid" UUID NOT NULL,
    "attributeUuid" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "value" TEXT,

    CONSTRAINT "ParticipantsAttributes_pkey" PRIMARY KEY ("uuid")
);

-- CreateTable
CREATE TABLE "ParticipantsEmails" (
    "uuid" UUID NOT NULL,
    "status" "EmailStatus" NOT NULL,
    "sendAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "sendBy" TEXT,
    "participantUuid" UUID,
    "emailUuid" UUID,

    CONSTRAINT "ParticipantsEmails_pkey" PRIMARY KEY ("uuid")
);

-- CreateTable
CREATE TABLE "ParticipantsForms" (
    "uuid" UUID NOT NULL,
    "participantUuid" UUID NOT NULL,
    "formUuid" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "lastOpenedAt" TIMESTAMP(3),
    "lastSubmittedAt" TIMESTAMP(3),
    "emailUuid" UUID,

    CONSTRAINT "ParticipantsForms_pkey" PRIMARY KEY ("uuid")
);

-- CreateTable
CREATE TABLE "ParticipantsAttributesLogs" (
    "uuid" UUID NOT NULL,
    "participantUuid" UUID NOT NULL,
    "triggeredBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "triggeredUuid" UUID,
    "attributeUuid" UUID,
    "before" TEXT,
    "after" TEXT,

    CONSTRAINT "ParticipantsAttributesLogs_pkey" PRIMARY KEY ("uuid")
);

-- CreateTable
CREATE TABLE "AuthAccessTokens" (
    "id" SERIAL NOT NULL,
    "tokenable_id" UUID NOT NULL,
    "type" TEXT NOT NULL,
    "name" TEXT,
    "hash" TEXT NOT NULL,
    "abilities" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "last_used_at" TIMESTAMP(3) NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AuthAccessTokens_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Admins_email_key" ON "Admins"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Events_slug_key" ON "Events"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "Participants_email_eventUuid_key" ON "Participants"("email", "eventUuid");

-- CreateIndex
CREATE UNIQUE INDEX "AuthAccessTokens_tokenable_id_key" ON "AuthAccessTokens"("tokenable_id");

-- AddForeignKey
ALTER TABLE "AdminsPermissions" ADD CONSTRAINT "AdminsPermissions_adminUuid_fkey" FOREIGN KEY ("adminUuid") REFERENCES "Admins"("uuid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdminsPermissions" ADD CONSTRAINT "AdminsPermissions_eventUuid_fkey" FOREIGN KEY ("eventUuid") REFERENCES "Events"("uuid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdminsPermissions" ADD CONSTRAINT "AdminsPermissions_permissionUuid_fkey" FOREIGN KEY ("permissionUuid") REFERENCES "Permissions"("uuid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Events" ADD CONSTRAINT "Events_organizerUuid_fkey" FOREIGN KEY ("organizerUuid") REFERENCES "Admins"("uuid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Events" ADD CONSTRAINT "Events_registerFormUuid_fkey" FOREIGN KEY ("registerFormUuid") REFERENCES "Forms"("uuid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Attributes" ADD CONSTRAINT "Attributes_eventUuid_fkey" FOREIGN KEY ("eventUuid") REFERENCES "Events"("uuid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Blocks" ADD CONSTRAINT "Blocks_parentUuid_fkey" FOREIGN KEY ("parentUuid") REFERENCES "Blocks"("uuid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Blocks" ADD CONSTRAINT "Blocks_attributeUuid_fkey" FOREIGN KEY ("attributeUuid") REFERENCES "Attributes"("uuid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Emails" ADD CONSTRAINT "Emails_eventUuid_fkey" FOREIGN KEY ("eventUuid") REFERENCES "Events"("uuid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Emails" ADD CONSTRAINT "Emails_formUuid_fkey" FOREIGN KEY ("formUuid") REFERENCES "Forms"("uuid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Forms" ADD CONSTRAINT "Forms_eventUuid_fkey" FOREIGN KEY ("eventUuid") REFERENCES "Events"("uuid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FormsDefinitions" ADD CONSTRAINT "FormsDefinitions_attributeUuid_fkey" FOREIGN KEY ("attributeUuid") REFERENCES "Attributes"("uuid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FormsDefinitions" ADD CONSTRAINT "FormsDefinitions_formUuid_fkey" FOREIGN KEY ("formUuid") REFERENCES "Forms"("uuid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Participants" ADD CONSTRAINT "Participants_eventUuid_fkey" FOREIGN KEY ("eventUuid") REFERENCES "Events"("uuid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ParticipantsAttributes" ADD CONSTRAINT "ParticipantsAttributes_participantUuid_fkey" FOREIGN KEY ("participantUuid") REFERENCES "Participants"("uuid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ParticipantsAttributes" ADD CONSTRAINT "ParticipantsAttributes_attributeUuid_fkey" FOREIGN KEY ("attributeUuid") REFERENCES "Attributes"("uuid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ParticipantsEmails" ADD CONSTRAINT "ParticipantsEmails_participantUuid_fkey" FOREIGN KEY ("participantUuid") REFERENCES "Participants"("uuid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ParticipantsEmails" ADD CONSTRAINT "ParticipantsEmails_emailUuid_fkey" FOREIGN KEY ("emailUuid") REFERENCES "Emails"("uuid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ParticipantsForms" ADD CONSTRAINT "ParticipantsForms_participantUuid_fkey" FOREIGN KEY ("participantUuid") REFERENCES "Participants"("uuid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ParticipantsForms" ADD CONSTRAINT "ParticipantsForms_formUuid_fkey" FOREIGN KEY ("formUuid") REFERENCES "Forms"("uuid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ParticipantsForms" ADD CONSTRAINT "ParticipantsForms_emailUuid_fkey" FOREIGN KEY ("emailUuid") REFERENCES "Emails"("uuid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ParticipantsAttributesLogs" ADD CONSTRAINT "ParticipantsAttributesLogs_participantUuid_fkey" FOREIGN KEY ("participantUuid") REFERENCES "Participants"("uuid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuthAccessTokens" ADD CONSTRAINT "AuthAccessTokens_tokenable_id_fkey" FOREIGN KEY ("tokenable_id") REFERENCES "Admins"("uuid") ON DELETE CASCADE ON UPDATE CASCADE;
