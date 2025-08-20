-- CreateEnum
CREATE TYPE "public"."OrganizerType" AS ENUM ('organizer', 'superadmin');

-- CreateTable
CREATE TABLE "public"."Admin" (
    "id" UUID NOT NULL,
    "firstName" VARCHAR(255) NOT NULL,
    "lastName" VARCHAR(255) NOT NULL,
    "password" VARCHAR(255) NOT NULL,
    "email" VARCHAR(255) NOT NULL,
    "type" "public"."OrganizerType" NOT NULL DEFAULT 'organizer',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Admin_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."AdminPermission" (
    "id" UUID NOT NULL,
    "event_id" UUID NOT NULL,
    "permission_id" UUID NOT NULL,
    "admin_id" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AdminPermission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Permission" (
    "id" UUID NOT NULL,
    "action" VARCHAR(255) NOT NULL,
    "subject" VARCHAR(255) NOT NULL,
    "organizer_id" UUID,
    "register_form_id" UUID,

    CONSTRAINT "Permission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Event" (
    "id" UUID NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "links" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "policy_links" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "start_date" TIMESTAMP(3) NOT NULL,
    "end_date" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "participants_limit" INTEGER,
    "verified_at" TIMESTAMP(3),
    "description" TEXT,
    "primary_color" VARCHAR(12),
    "organizer_name" VARCHAR(255),
    "photo_url" VARCHAR(255),
    "location" VARCHAR(255),
    "contact_email" VARCHAR(255),
    "slug" VARCHAR(255),
    "organizer_id" UUID,
    "register_form_id" UUID,

    CONSTRAINT "Event_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Attribute" (
    "id" UUID NOT NULL,
    "event_id" UUID NOT NULL,
    "type" VARCHAR(50) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "show_in_list" BOOLEAN NOT NULL DEFAULT true,
    "options" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "name" VARCHAR(255),

    CONSTRAINT "Attribute_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Block" (
    "id" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "capacity" INTEGER,
    "order" INTEGER,
    "name" VARCHAR(255),
    "description" TEXT,
    "parent_id" UUID,
    "attribute_id" UUID,

    CONSTRAINT "Block_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Email" (
    "id" UUID NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "content" TEXT NOT NULL,
    "trigger" VARCHAR(255) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "trigger_value" VARCHAR(255),
    "trigger_value_2" VARCHAR(255),
    "event_id" UUID,
    "form_id" UUID,

    CONSTRAINT "Email_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Form" (
    "id" UUID NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "open_date" TIMESTAMP(3),
    "close_date" TIMESTAMP(3),
    "description" TEXT,
    "event_id" UUID,
    "is_editable" BOOLEAN,

    CONSTRAINT "Form_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."FormDefinition" (
    "id" UUID NOT NULL,
    "is_required" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "order" INTEGER,
    "attribute_id" UUID,
    "form_id" UUID,

    CONSTRAINT "FormDefinition_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Participant" (
    "id" UUID NOT NULL,
    "email" VARCHAR(255) NOT NULL,
    "event_id" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Participant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."ParticipantAttribute" (
    "id" UUID NOT NULL,
    "participant_id" UUID NOT NULL,
    "attribute_id" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "value" TEXT,

    CONSTRAINT "ParticipantAttribute_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."ParticipantEmail" (
    "id" UUID NOT NULL,
    "status" VARCHAR(50) NOT NULL,
    "send_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "send_by" VARCHAR(255),
    "participant_id" UUID,
    "email_id" UUID,

    CONSTRAINT "ParticipantEmail_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."ParticipantForm" (
    "id" UUID NOT NULL,
    "participant_id" UUID NOT NULL,
    "form_id" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "last_opened_at" TIMESTAMP(3),
    "last_submitted_at" TIMESTAMP(3),
    "email_id" UUID,

    CONSTRAINT "ParticipantForm_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."ParticipantAttributeLog" (
    "id" UUID NOT NULL,
    "participant_id" UUID NOT NULL,
    "triggered_by" VARCHAR(50) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "triggered_id" UUID,
    "attribute_id" UUID,
    "before" TEXT,
    "after" TEXT,

    CONSTRAINT "ParticipantAttributeLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Admin_email_key" ON "public"."Admin"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Event_slug_key" ON "public"."Event"("slug");

-- AddForeignKey
ALTER TABLE "public"."AdminPermission" ADD CONSTRAINT "AdminPermission_admin_id_fkey" FOREIGN KEY ("admin_id") REFERENCES "public"."Admin"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."AdminPermission" ADD CONSTRAINT "AdminPermission_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "public"."Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."AdminPermission" ADD CONSTRAINT "AdminPermission_permission_id_fkey" FOREIGN KEY ("permission_id") REFERENCES "public"."Permission"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Event" ADD CONSTRAINT "Event_organizer_id_fkey" FOREIGN KEY ("organizer_id") REFERENCES "public"."Admin"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Event" ADD CONSTRAINT "Event_register_form_id_fkey" FOREIGN KEY ("register_form_id") REFERENCES "public"."Form"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Attribute" ADD CONSTRAINT "Attribute_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "public"."Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Block" ADD CONSTRAINT "Block_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "public"."Block"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Block" ADD CONSTRAINT "Block_attribute_id_fkey" FOREIGN KEY ("attribute_id") REFERENCES "public"."Attribute"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Email" ADD CONSTRAINT "Email_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "public"."Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Email" ADD CONSTRAINT "Email_form_id_fkey" FOREIGN KEY ("form_id") REFERENCES "public"."Form"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Form" ADD CONSTRAINT "Form_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "public"."Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."FormDefinition" ADD CONSTRAINT "FormDefinition_attribute_id_fkey" FOREIGN KEY ("attribute_id") REFERENCES "public"."Attribute"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."FormDefinition" ADD CONSTRAINT "FormDefinition_form_id_fkey" FOREIGN KEY ("form_id") REFERENCES "public"."Form"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Participant" ADD CONSTRAINT "Participant_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "public"."Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ParticipantAttribute" ADD CONSTRAINT "ParticipantAttribute_participant_id_fkey" FOREIGN KEY ("participant_id") REFERENCES "public"."Participant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ParticipantAttribute" ADD CONSTRAINT "ParticipantAttribute_attribute_id_fkey" FOREIGN KEY ("attribute_id") REFERENCES "public"."Attribute"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ParticipantEmail" ADD CONSTRAINT "ParticipantEmail_participant_id_fkey" FOREIGN KEY ("participant_id") REFERENCES "public"."Participant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ParticipantEmail" ADD CONSTRAINT "ParticipantEmail_email_id_fkey" FOREIGN KEY ("email_id") REFERENCES "public"."Email"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ParticipantForm" ADD CONSTRAINT "ParticipantForm_participant_id_fkey" FOREIGN KEY ("participant_id") REFERENCES "public"."Participant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ParticipantForm" ADD CONSTRAINT "ParticipantForm_form_id_fkey" FOREIGN KEY ("form_id") REFERENCES "public"."Form"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ParticipantForm" ADD CONSTRAINT "ParticipantForm_email_id_fkey" FOREIGN KEY ("email_id") REFERENCES "public"."Email"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ParticipantAttributeLog" ADD CONSTRAINT "ParticipantAttributeLog_participant_id_fkey" FOREIGN KEY ("participant_id") REFERENCES "public"."Participant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
