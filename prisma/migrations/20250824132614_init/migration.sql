-- CreateEnum
CREATE TYPE "public"."OrganizerType" AS ENUM ('organizer', 'superadmin');

-- CreateEnum
CREATE TYPE "public"."AttributeType" AS ENUM ('text', 'textArea', 'number', 'file', 'select', 'block', 'date', 'time', 'datetime', 'multiSelect', 'email', 'tel', 'color', 'checkbox');

-- CreateEnum
CREATE TYPE "public"."EmailTrigger" AS ENUM ('PARTICIPANT_REGISTERED', 'PARTICIPANT_DELETED', 'FORM_FILLED', 'ATTRIBUTE_CHANGED', 'MANUAL');

-- CreateEnum
CREATE TYPE "public"."EmailStatus" AS ENUM ('pending', 'sent', 'failed');

-- CreateTable
CREATE TABLE "public"."Admin" (
    "uuid" UUID NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "type" "public"."OrganizerType" NOT NULL DEFAULT 'organizer',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Admin_pkey" PRIMARY KEY ("uuid")
);

-- CreateTable
CREATE TABLE "public"."AdminPermission" (
    "uuid" UUID NOT NULL,
    "eventUuid" UUID NOT NULL,
    "permissionUuid" UUID NOT NULL,
    "adminUuid" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AdminPermission_pkey" PRIMARY KEY ("uuid")
);

-- CreateTable
CREATE TABLE "public"."Permission" (
    "uuid" UUID NOT NULL,
    "action" TEXT NOT NULL,
    "subject" TEXT NOT NULL,

    CONSTRAINT "Permission_pkey" PRIMARY KEY ("uuid")
);

-- CreateTable
CREATE TABLE "public"."Event" (
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

    CONSTRAINT "Event_pkey" PRIMARY KEY ("uuid")
);

-- CreateTable
CREATE TABLE "public"."Attribute" (
    "uuid" UUID NOT NULL,
    "eventUuid" UUID NOT NULL,
    "type" "public"."AttributeType" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "showInList" BOOLEAN NOT NULL DEFAULT true,
    "options" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "name" TEXT,

    CONSTRAINT "Attribute_pkey" PRIMARY KEY ("uuid")
);

-- CreateTable
CREATE TABLE "public"."Block" (
    "uuid" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "capacity" INTEGER,
    "order" INTEGER,
    "name" TEXT,
    "description" TEXT,
    "parentUuid" UUID,
    "attributeUuid" UUID,

    CONSTRAINT "Block_pkey" PRIMARY KEY ("uuid")
);

-- CreateTable
CREATE TABLE "public"."Email" (
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

    CONSTRAINT "Email_pkey" PRIMARY KEY ("uuid")
);

-- CreateTable
CREATE TABLE "public"."Form" (
    "uuid" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "isEditable" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "openDate" TIMESTAMP(3),
    "closeDate" TIMESTAMP(3),
    "description" TEXT,
    "eventUuid" UUID,

    CONSTRAINT "Form_pkey" PRIMARY KEY ("uuid")
);

-- CreateTable
CREATE TABLE "public"."FormDefinition" (
    "uuid" UUID NOT NULL,
    "isRequired" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "order" INTEGER,
    "attributeUuid" UUID,
    "formUuid" UUID,

    CONSTRAINT "FormDefinition_pkey" PRIMARY KEY ("uuid")
);

-- CreateTable
CREATE TABLE "public"."Participant" (
    "uuid" UUID NOT NULL,
    "email" TEXT NOT NULL,
    "eventUuid" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Participant_pkey" PRIMARY KEY ("uuid")
);

-- CreateTable
CREATE TABLE "public"."ParticipantAttribute" (
    "uuid" UUID NOT NULL,
    "participantUuid" UUID NOT NULL,
    "attributeUuid" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "value" TEXT,

    CONSTRAINT "ParticipantAttribute_pkey" PRIMARY KEY ("uuid")
);

-- CreateTable
CREATE TABLE "public"."ParticipantEmail" (
    "uuid" UUID NOT NULL,
    "status" "public"."EmailStatus" NOT NULL,
    "sendAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "sendBy" TEXT,
    "participantUuid" UUID,
    "emailUuid" UUID,

    CONSTRAINT "ParticipantEmail_pkey" PRIMARY KEY ("uuid")
);

-- CreateTable
CREATE TABLE "public"."ParticipantForm" (
    "uuid" UUID NOT NULL,
    "participantUuid" UUID NOT NULL,
    "formUuid" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "lastOpenedAt" TIMESTAMP(3),
    "lastSubmittedAt" TIMESTAMP(3),
    "emailUuid" UUID,

    CONSTRAINT "ParticipantForm_pkey" PRIMARY KEY ("uuid")
);

-- CreateTable
CREATE TABLE "public"."ParticipantAttributeLog" (
    "uuid" UUID NOT NULL,
    "participantUuid" UUID NOT NULL,
    "triggeredBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "triggeredUuid" UUID,
    "attributeUuid" UUID,
    "before" TEXT,
    "after" TEXT,

    CONSTRAINT "ParticipantAttributeLog_pkey" PRIMARY KEY ("uuid")
);

-- CreateIndex
CREATE UNIQUE INDEX "Admin_email_key" ON "public"."Admin"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Event_slug_key" ON "public"."Event"("slug");

-- AddForeignKey
ALTER TABLE "public"."AdminPermission" ADD CONSTRAINT "AdminPermission_adminUuid_fkey" FOREIGN KEY ("adminUuid") REFERENCES "public"."Admin"("uuid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."AdminPermission" ADD CONSTRAINT "AdminPermission_eventUuid_fkey" FOREIGN KEY ("eventUuid") REFERENCES "public"."Event"("uuid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."AdminPermission" ADD CONSTRAINT "AdminPermission_permissionUuid_fkey" FOREIGN KEY ("permissionUuid") REFERENCES "public"."Permission"("uuid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Event" ADD CONSTRAINT "Event_organizerUuid_fkey" FOREIGN KEY ("organizerUuid") REFERENCES "public"."Admin"("uuid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Event" ADD CONSTRAINT "Event_registerFormUuid_fkey" FOREIGN KEY ("registerFormUuid") REFERENCES "public"."Form"("uuid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Attribute" ADD CONSTRAINT "Attribute_eventUuid_fkey" FOREIGN KEY ("eventUuid") REFERENCES "public"."Event"("uuid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Block" ADD CONSTRAINT "Block_parentUuid_fkey" FOREIGN KEY ("parentUuid") REFERENCES "public"."Block"("uuid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Block" ADD CONSTRAINT "Block_attributeUuid_fkey" FOREIGN KEY ("attributeUuid") REFERENCES "public"."Attribute"("uuid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Email" ADD CONSTRAINT "Email_eventUuid_fkey" FOREIGN KEY ("eventUuid") REFERENCES "public"."Event"("uuid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Email" ADD CONSTRAINT "Email_formUuid_fkey" FOREIGN KEY ("formUuid") REFERENCES "public"."Form"("uuid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Form" ADD CONSTRAINT "Form_eventUuid_fkey" FOREIGN KEY ("eventUuid") REFERENCES "public"."Event"("uuid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."FormDefinition" ADD CONSTRAINT "FormDefinition_attributeUuid_fkey" FOREIGN KEY ("attributeUuid") REFERENCES "public"."Attribute"("uuid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."FormDefinition" ADD CONSTRAINT "FormDefinition_formUuid_fkey" FOREIGN KEY ("formUuid") REFERENCES "public"."Form"("uuid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Participant" ADD CONSTRAINT "Participant_eventUuid_fkey" FOREIGN KEY ("eventUuid") REFERENCES "public"."Event"("uuid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ParticipantAttribute" ADD CONSTRAINT "ParticipantAttribute_participantUuid_fkey" FOREIGN KEY ("participantUuid") REFERENCES "public"."Participant"("uuid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ParticipantAttribute" ADD CONSTRAINT "ParticipantAttribute_attributeUuid_fkey" FOREIGN KEY ("attributeUuid") REFERENCES "public"."Attribute"("uuid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ParticipantEmail" ADD CONSTRAINT "ParticipantEmail_participantUuid_fkey" FOREIGN KEY ("participantUuid") REFERENCES "public"."Participant"("uuid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ParticipantEmail" ADD CONSTRAINT "ParticipantEmail_emailUuid_fkey" FOREIGN KEY ("emailUuid") REFERENCES "public"."Email"("uuid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ParticipantForm" ADD CONSTRAINT "ParticipantForm_participantUuid_fkey" FOREIGN KEY ("participantUuid") REFERENCES "public"."Participant"("uuid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ParticipantForm" ADD CONSTRAINT "ParticipantForm_formUuid_fkey" FOREIGN KEY ("formUuid") REFERENCES "public"."Form"("uuid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ParticipantForm" ADD CONSTRAINT "ParticipantForm_emailUuid_fkey" FOREIGN KEY ("emailUuid") REFERENCES "public"."Email"("uuid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ParticipantAttributeLog" ADD CONSTRAINT "ParticipantAttributeLog_participantUuid_fkey" FOREIGN KEY ("participantUuid") REFERENCES "public"."Participant"("uuid") ON DELETE CASCADE ON UPDATE CASCADE;
