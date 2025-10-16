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
ALTER TABLE "public"."AdminPermission" DROP CONSTRAINT "AdminPermission_adminUuid_fkey";

-- DropForeignKey
ALTER TABLE "public"."AdminPermission" DROP CONSTRAINT "AdminPermission_eventUuid_fkey";

-- DropForeignKey
ALTER TABLE "public"."AdminPermission" DROP CONSTRAINT "AdminPermission_permissionUuid_fkey";

-- DropForeignKey
ALTER TABLE "public"."Attribute" DROP CONSTRAINT "Attribute_eventUuid_fkey";

-- DropForeignKey
ALTER TABLE "public"."Block" DROP CONSTRAINT "Block_attributeUuid_fkey";

-- DropForeignKey
ALTER TABLE "public"."Block" DROP CONSTRAINT "Block_parentUuid_fkey";

-- DropForeignKey
ALTER TABLE "public"."Email" DROP CONSTRAINT "Email_eventUuid_fkey";

-- DropForeignKey
ALTER TABLE "public"."Email" DROP CONSTRAINT "Email_formUuid_fkey";

-- DropForeignKey
ALTER TABLE "public"."Event" DROP CONSTRAINT "Event_organizerUuid_fkey";

-- DropForeignKey
ALTER TABLE "public"."Event" DROP CONSTRAINT "Event_registerFormUuid_fkey";

-- DropForeignKey
ALTER TABLE "public"."Form" DROP CONSTRAINT "Form_eventUuid_fkey";

-- DropForeignKey
ALTER TABLE "public"."FormDefinition" DROP CONSTRAINT "FormDefinition_attributeUuid_fkey";

-- DropForeignKey
ALTER TABLE "public"."FormDefinition" DROP CONSTRAINT "FormDefinition_formUuid_fkey";

-- DropForeignKey
ALTER TABLE "public"."Participant" DROP CONSTRAINT "Participant_eventUuid_fkey";

-- DropForeignKey
ALTER TABLE "public"."ParticipantAttribute" DROP CONSTRAINT "ParticipantAttribute_attributeUuid_fkey";

-- DropForeignKey
ALTER TABLE "public"."ParticipantAttribute" DROP CONSTRAINT "ParticipantAttribute_participantUuid_fkey";

-- DropForeignKey
ALTER TABLE "public"."ParticipantAttributeLog" DROP CONSTRAINT "ParticipantAttributeLog_participantUuid_fkey";

-- DropForeignKey
ALTER TABLE "public"."ParticipantEmail" DROP CONSTRAINT "ParticipantEmail_emailUuid_fkey";

-- DropForeignKey
ALTER TABLE "public"."ParticipantEmail" DROP CONSTRAINT "ParticipantEmail_participantUuid_fkey";

-- DropForeignKey
ALTER TABLE "public"."ParticipantForm" DROP CONSTRAINT "ParticipantForm_emailUuid_fkey";

-- DropForeignKey
ALTER TABLE "public"."ParticipantForm" DROP CONSTRAINT "ParticipantForm_formUuid_fkey";

-- DropForeignKey
ALTER TABLE "public"."ParticipantForm" DROP CONSTRAINT "ParticipantForm_participantUuid_fkey";

-- DropTable
DROP TABLE "public"."Admin";

-- DropTable
DROP TABLE "public"."AdminPermission";

-- DropTable
DROP TABLE "public"."Attribute";

-- DropTable
DROP TABLE "public"."Block";

-- DropTable
DROP TABLE "public"."Email";

-- DropTable
DROP TABLE "public"."Event";

-- DropTable
DROP TABLE "public"."Form";

-- DropTable
DROP TABLE "public"."FormDefinition";

-- DropTable
DROP TABLE "public"."Participant";

-- DropTable
DROP TABLE "public"."ParticipantAttribute";

-- DropTable
DROP TABLE "public"."ParticipantAttributeLog";

-- DropTable
DROP TABLE "public"."ParticipantEmail";

-- DropTable
DROP TABLE "public"."ParticipantForm";

-- DropTable
DROP TABLE "public"."Permission";

-- CreateTable
CREATE TABLE "public"."Admins" (
    "uuid" UUID NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "type" "public"."OrganizerType" NOT NULL DEFAULT 'organizer',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Admins_pkey" PRIMARY KEY ("uuid")
);

-- CreateTable
CREATE TABLE "public"."AdminsPermissions" (
    "uuid" UUID NOT NULL,
    "eventUuid" UUID NOT NULL,
    "permissionUuid" UUID NOT NULL,
    "adminUuid" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AdminsPermissions_pkey" PRIMARY KEY ("uuid")
);

-- CreateTable
CREATE TABLE "public"."Permissions" (
    "uuid" UUID NOT NULL,
    "action" TEXT NOT NULL,
    "subject" TEXT NOT NULL,

    CONSTRAINT "Permissions_pkey" PRIMARY KEY ("uuid")
);

-- CreateTable
CREATE TABLE "public"."Events" (
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
CREATE TABLE "public"."Attributes" (
    "uuid" UUID NOT NULL,
    "eventUuid" UUID NOT NULL,
    "type" "public"."AttributeType" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "showInList" BOOLEAN NOT NULL DEFAULT true,
    "order" INTEGER NOT NULL,
    "options" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "name" TEXT,

    CONSTRAINT "Attributes_pkey" PRIMARY KEY ("uuid")
);

-- CreateTable
CREATE TABLE "public"."Blocks" (
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
CREATE TABLE "public"."Emails" (
    "uuid" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "trigger" "public"."EmailTrigger" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "triggerValue" TEXT,
    "triggerValue2" TEXT,
    "eventUuid" UUID,
    "formUuid" UUID,

    CONSTRAINT "Emails_pkey" PRIMARY KEY ("uuid")
);

-- CreateTable
CREATE TABLE "public"."Forms" (
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
CREATE TABLE "public"."FormsDefinitions" (
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
CREATE TABLE "public"."Participants" (
    "uuid" UUID NOT NULL,
    "email" TEXT NOT NULL,
    "eventUuid" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Participants_pkey" PRIMARY KEY ("uuid")
);

-- CreateTable
CREATE TABLE "public"."ParticipantsAttributes" (
    "uuid" UUID NOT NULL,
    "participantUuid" UUID NOT NULL,
    "attributeUuid" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "value" TEXT,

    CONSTRAINT "ParticipantsAttributes_pkey" PRIMARY KEY ("uuid")
);

-- CreateTable
CREATE TABLE "public"."ParticipantsEmails" (
    "uuid" UUID NOT NULL,
    "status" "public"."EmailStatus" NOT NULL,
    "sendAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "sendBy" TEXT,
    "participantUuid" UUID,
    "emailUuid" UUID,

    CONSTRAINT "ParticipantsEmails_pkey" PRIMARY KEY ("uuid")
);

-- CreateTable
CREATE TABLE "public"."ParticipantsForms" (
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
CREATE TABLE "public"."ParticipantsAttributesLogs" (
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
CREATE TABLE "public"."AuthAccessTokens" (
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
CREATE UNIQUE INDEX "Admins_email_key" ON "public"."Admins"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Events_slug_key" ON "public"."Events"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "AuthAccessTokens_tokenable_id_key" ON "public"."AuthAccessTokens"("tokenable_id");

-- AddForeignKey
ALTER TABLE "public"."AdminsPermissions" ADD CONSTRAINT "AdminsPermissions_adminUuid_fkey" FOREIGN KEY ("adminUuid") REFERENCES "public"."Admins"("uuid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."AdminsPermissions" ADD CONSTRAINT "AdminsPermissions_eventUuid_fkey" FOREIGN KEY ("eventUuid") REFERENCES "public"."Events"("uuid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."AdminsPermissions" ADD CONSTRAINT "AdminsPermissions_permissionUuid_fkey" FOREIGN KEY ("permissionUuid") REFERENCES "public"."Permissions"("uuid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Events" ADD CONSTRAINT "Events_organizerUuid_fkey" FOREIGN KEY ("organizerUuid") REFERENCES "public"."Admins"("uuid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Events" ADD CONSTRAINT "Events_registerFormUuid_fkey" FOREIGN KEY ("registerFormUuid") REFERENCES "public"."Forms"("uuid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Attributes" ADD CONSTRAINT "Attributes_eventUuid_fkey" FOREIGN KEY ("eventUuid") REFERENCES "public"."Events"("uuid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Blocks" ADD CONSTRAINT "Blocks_parentUuid_fkey" FOREIGN KEY ("parentUuid") REFERENCES "public"."Blocks"("uuid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Blocks" ADD CONSTRAINT "Blocks_attributeUuid_fkey" FOREIGN KEY ("attributeUuid") REFERENCES "public"."Attributes"("uuid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Emails" ADD CONSTRAINT "Emails_eventUuid_fkey" FOREIGN KEY ("eventUuid") REFERENCES "public"."Events"("uuid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Emails" ADD CONSTRAINT "Emails_formUuid_fkey" FOREIGN KEY ("formUuid") REFERENCES "public"."Forms"("uuid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Forms" ADD CONSTRAINT "Forms_eventUuid_fkey" FOREIGN KEY ("eventUuid") REFERENCES "public"."Events"("uuid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."FormsDefinitions" ADD CONSTRAINT "FormsDefinitions_attributeUuid_fkey" FOREIGN KEY ("attributeUuid") REFERENCES "public"."Attributes"("uuid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."FormsDefinitions" ADD CONSTRAINT "FormsDefinitions_formUuid_fkey" FOREIGN KEY ("formUuid") REFERENCES "public"."Forms"("uuid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Participants" ADD CONSTRAINT "Participants_eventUuid_fkey" FOREIGN KEY ("eventUuid") REFERENCES "public"."Events"("uuid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ParticipantsAttributes" ADD CONSTRAINT "ParticipantsAttributes_participantUuid_fkey" FOREIGN KEY ("participantUuid") REFERENCES "public"."Participants"("uuid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ParticipantsAttributes" ADD CONSTRAINT "ParticipantsAttributes_attributeUuid_fkey" FOREIGN KEY ("attributeUuid") REFERENCES "public"."Attributes"("uuid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ParticipantsEmails" ADD CONSTRAINT "ParticipantsEmails_participantUuid_fkey" FOREIGN KEY ("participantUuid") REFERENCES "public"."Participants"("uuid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ParticipantsEmails" ADD CONSTRAINT "ParticipantsEmails_emailUuid_fkey" FOREIGN KEY ("emailUuid") REFERENCES "public"."Emails"("uuid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ParticipantsForms" ADD CONSTRAINT "ParticipantsForms_participantUuid_fkey" FOREIGN KEY ("participantUuid") REFERENCES "public"."Participants"("uuid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ParticipantsForms" ADD CONSTRAINT "ParticipantsForms_formUuid_fkey" FOREIGN KEY ("formUuid") REFERENCES "public"."Forms"("uuid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ParticipantsForms" ADD CONSTRAINT "ParticipantsForms_emailUuid_fkey" FOREIGN KEY ("emailUuid") REFERENCES "public"."Emails"("uuid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ParticipantsAttributesLogs" ADD CONSTRAINT "ParticipantsAttributesLogs_participantUuid_fkey" FOREIGN KEY ("participantUuid") REFERENCES "public"."Participants"("uuid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."AuthAccessTokens" ADD CONSTRAINT "AuthAccessTokens_tokenable_id_fkey" FOREIGN KEY ("tokenable_id") REFERENCES "public"."Admins"("uuid") ON DELETE CASCADE ON UPDATE CASCADE;
