import { PrismaPg } from "@prisma/adapter-pg";
import * as bcrypt from "bcrypt";
import "dotenv/config";

import type {
  Admin,
  Attribute,
  Block,
  EmailTemplate,
  Event,
  EventLink,
  Form,
  Participant,
  ParticipantAttributeLog,
  ParticipantEmailStatus,
  ParticipantFormLog,
} from "../src/generated/prisma/client";
import {
  AttributeType,
  EmailStatus,
  EmailTrigger,
  EventLinkType,
  LogTrigger,
  OrganizerType,
  PermissionType,
  PrismaClient,
} from "../src/generated/prisma/client";

if (
  process.env.DATABASE_URL === undefined ||
  process.env.DATABASE_URL.trim() === ""
) {
  throw new Error(
    "Brak zmiennej DATABASE_URL w procesie! Upewnij się, że plik .env istnieje.",
  );
}

const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL,
});
const prisma = new PrismaClient({ adapter });

async function main() {
  await prisma.auditLog.deleteMany();
  await prisma.participantAttributeLog.deleteMany();
  await prisma.eventPermission.deleteMany();
  await prisma.eventLink.deleteMany();
  await prisma.participantAttribute.deleteMany();
  await prisma.participantEmailStatus.deleteMany();
  await prisma.participantFormLog.deleteMany();
  await prisma.formDefinition.deleteMany();
  await prisma.block.deleteMany();
  await prisma.emailTemplate.deleteMany();
  await prisma.form.deleteMany();
  await prisma.attribute.deleteMany();
  await prisma.participant.deleteMany();
  await prisma.event.deleteMany();
  await prisma.admin.deleteMany();

  const defaultPassword = "changeme";
  const hashedPassword = await bcrypt.hash(defaultPassword, 12);

  await prisma.admin.upsert({
    where: { email: "admin@solvro.pl" },
    update: {},
    create: {
      firstName: "SuperAdmin",
      lastName: "Solvro",
      password: hashedPassword,
      email: "admin@solvro.pl",
      type: OrganizerType.superadmin,
      active: true,
    },
  });

  const admin: Admin = await prisma.admin.upsert({
    where: { email: "admin@example.com" },
    update: {},
    create: {
      firstName: "Admin",
      lastName: "User",
      password: hashedPassword,
      email: "admin@example.com",
      type: OrganizerType.organizer,
      active: true,
    },
  });

  const event: Event = await prisma.event.create({
    data: {
      name: "Sample Event",
      description: "A test event lorem sigmum",
      startDate: new Date(Date.now() + 1000 * 60 * 60 * 24 * 7),
      endDate: new Date(Date.now() + 1000 * 60 * 60 * 24 * 8),
      organizerUuid: admin.uuid,
      organizerName: "Test Org",
      participantsLimit: 100,
      photoKey: "https://placehold.co/200x200",
      location: "Test City",
      contactEmail: "contact@example.com",
      slug: "sample-event",
      isPublic: true,
      isVerified: true,
      isFeatured: true,
    },
  });

  await prisma.eventPermission.upsert({
    where: {
      eventUuid_adminUuid_permission: {
        eventUuid: event.uuid,
        adminUuid: admin.uuid,
        permission: PermissionType.MANAGE_ALL,
      },
    },
    update: {},
    create: {
      adminUuid: admin.uuid,
      eventUuid: event.uuid,
      permission: PermissionType.MANAGE_ALL,
    },
  });

  const generalLink: EventLink = await prisma.eventLink.create({
    data: {
      eventUuid: event.uuid,
      type: EventLinkType.general,
      url: "https://example.com/sample-event",
      label: "General info",
    },
  });

  const policyLink: EventLink = await prisma.eventLink.create({
    data: {
      eventUuid: event.uuid,
      type: EventLinkType.policy,
      url: "https://example.com/sample-event/privacy-policy",
      label: "Privacy policy",
    },
  });

  const sizeAttribute: Attribute = await prisma.attribute.create({
    data: {
      name: "T-shirt size",
      eventUuid: event.uuid,
      type: AttributeType.select,
      config: { options: ["S", "M", "L", "XL"] },
      showInList: true,
      order: 1,
    },
  });

  const dietAttribute: Attribute = await prisma.attribute.create({
    data: {
      name: "Dietary requirements",
      eventUuid: event.uuid,
      type: AttributeType.text,
      config: {},
      showInList: false,
      order: 2,
    },
  });

  const termsAttribute: Attribute = await prisma.attribute.create({
    data: {
      name: "I agree to the Terms & Conditions",
      eventUuid: event.uuid,
      type: AttributeType.checkbox,
      config: {},
      showInList: false,
      order: 3,
    },
  });

  const interestsAttribute: Attribute = await prisma.attribute.create({
    data: {
      name: "Interests",
      eventUuid: event.uuid,
      type: AttributeType.multiSelect,
      config: {
        options: [
          "AI & Machine Learning",
          "Web Development",
          "Mobile",
          "DevOps",
        ],
        maxSelections: 3,
      },
      showInList: true,
      order: 4,
    },
  });

  const mainBlock: Block = await prisma.block.create({
    data: {
      name: "Main Building",
      description: "Main building",
      capacity: 200,
      attributeUuid: sizeAttribute.uuid,
      order: 1,
      isRootBlock: true,
    },
  });

  const classroomBlock: Block = await prisma.block.create({
    data: {
      name: "Room 101",
      description: "First floor room",
      capacity: 30,
      parentUuid: mainBlock.uuid,
      attributeUuid: sizeAttribute.uuid,
      order: 2,
    },
  });

  const seatBlock: Block = await prisma.block.create({
    data: {
      name: "Bed A1",
      description: "Front-left bed",
      capacity: 1,
      parentUuid: classroomBlock.uuid,
      attributeUuid: sizeAttribute.uuid,
      order: 1,
    },
  });

  const form: Form = await prisma.form.create({
    data: {
      name: "Registration",
      description: "Register for event",
      eventUuid: event.uuid,
      isEditable: true,
      isOpen: true,
    },
  });

  await prisma.formDefinition.createMany({
    data: [
      {
        attributeUuid: sizeAttribute.uuid,
        formUuid: form.uuid,
        isRequired: true,
        order: 1,
      },
      {
        attributeUuid: dietAttribute.uuid,
        formUuid: form.uuid,
        isRequired: false,
        order: 2,
      },
      {
        attributeUuid: termsAttribute.uuid,
        formUuid: form.uuid,
        isRequired: true,
        order: 3,
      },
      {
        attributeUuid: interestsAttribute.uuid,
        formUuid: form.uuid,
        isRequired: false,
        order: 4,
      },
    ],
  });

  const email: EmailTemplate = await prisma.emailTemplate.create({
    data: {
      eventUuid: event.uuid,
      name: "Welcome",
      content: "Welcome to the event!",
      trigger: EmailTrigger.PARTICIPANT_REGISTERED,
    },
  });

  const participant: Participant = await prisma.participant.create({
    data: {
      email: "participant@example.com",
      eventUuid: event.uuid,
    },
  });

  await prisma.participantAttribute.createMany({
    data: [
      {
        participantUuid: participant.uuid,
        attributeUuid: sizeAttribute.uuid,
        value: "M",
      },
      {
        participantUuid: participant.uuid,
        attributeUuid: dietAttribute.uuid,
        value: "Vegan",
      },
      {
        participantUuid: participant.uuid,
        attributeUuid: termsAttribute.uuid,
        value: true,
      },
      {
        participantUuid: participant.uuid,
        attributeUuid: interestsAttribute.uuid,
        value: ["Web Development", "DevOps"],
      },
    ],
  });

  const participantForm: ParticipantFormLog =
    await prisma.participantFormLog.create({
      data: {
        participantUuid: participant.uuid,
        formUuid: form.uuid,
        emailUuid: email.uuid,
      },
    });

  const participantEmail: ParticipantEmailStatus =
    await prisma.participantEmailStatus.create({
      data: {
        participantUuid: participant.uuid,
        emailUuid: email.uuid,
        sendAt: new Date(),
        sendBy: "SYSTEM",
        status: EmailStatus.sent,
      },
    });

  const participantAttributeLog: ParticipantAttributeLog =
    await prisma.participantAttributeLog.create({
      data: {
        participantUuid: participant.uuid,
        triggeredBy: LogTrigger.SYSTEM,
        triggeredUuid: admin.uuid,
        attributeUuid: sizeAttribute.uuid,
        before: undefined,
        after: "M",
      },
    });

  await prisma.event.update({
    where: { uuid: event.uuid },
    data: { registerFormUuid: form.uuid },
  });

  await prisma.auditLog.create({
    data: {
      action: "CREATE",
      entityType: "Event",
      entityUuid: event.uuid,
      triggeredBy: admin.email,
      before: undefined,
      after: {
        name: event.name,
        slug: event.slug,
        location: event.location,
        participantsLimit: event.participantsLimit,
      },
    },
  });

  await prisma.auditLog.create({
    data: {
      action: "UPDATE",
      entityType: "Event",
      entityUuid: event.uuid,
      triggeredBy: "SYSTEM",
      before: { registerFormUuid: null },
      after: { registerFormUuid: form.uuid },
    },
  });

  console.warn("Default password 'changeme'.", {
    adminUuid: admin.uuid,
    eventUuid: event.uuid,
    formUuid: form.uuid,
    participantUuid: participant.uuid,
  });
}

main()
  .catch((error: unknown) => {
    console.error(error);
    throw error;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
