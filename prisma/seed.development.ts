import { PrismaClient } from "../generated/prisma";
import type {
  Admin,
  Attribute,
  Block,
  Email,
  Event,
  Form,
  FormDefinition,
  Participant,
  ParticipantAttribute,
  ParticipantAttributeLog,
  ParticipantEmail,
  ParticipantForm,
  Permission,
} from "../generated/prisma";

const prisma = new PrismaClient();

async function main() {
  await prisma.participantAttributeLog.deleteMany();
  await prisma.adminPermission.deleteMany();
  await prisma.participantAttribute.deleteMany();
  await prisma.participantEmail.deleteMany();
  await prisma.participantForm.deleteMany();
  await prisma.formDefinition.deleteMany();
  await prisma.block.deleteMany();
  await prisma.email.deleteMany();
  await prisma.form.deleteMany();
  await prisma.attribute.deleteMany();
  await prisma.participant.deleteMany();
  await prisma.event.deleteMany();
  await prisma.permission.deleteMany();
  await prisma.admin.deleteMany();

  const admin: Admin = await prisma.admin.create({
    data: {
      first_name: "Admin",
      last_name: "User",
      password: "changeme",
      email: "admin@example.com",
      type: "organizer",
      active: true,
    },
  });

  const permission: Permission = await prisma.permission.create({
    data: {
      action: "manage",
      subject: "all",
    },
  });

  const event: Event = await prisma.event.create({
    data: {
      name: "Sample Event",
      description: "A test event lorem sigmum",
      start_date: new Date(Date.now() + 1000 * 60 * 60 * 24 * 7), // next week
      end_date: new Date(Date.now() + 1000 * 60 * 60 * 24 * 8),
      organizer_id: admin.id,
      organizer: "Test Org",
      participants_limit: 100,
      photo_url: "https://placehold.co/200x200",
      location: "Test City",
      contact_email: "contact@example.com",
      is_private: false,
      slug: "sample-event",
    },
  });

  await prisma.adminPermission.create({
    data: {
      admin_id: admin.id,
      event_id: event.id,
      permission_id: permission.id,
    },
  });

  const attribute: Attribute = await prisma.attribute.create({
    data: {
      name: "T-shirt size",
      event_id: event.id,
      type: "select",
      options: "S,M,L,XL",
      show_in_list: true,
    },
  });

  const mainBlock: Block = await prisma.block.create({
    data: {
      name: "Main Building",
      description: "Main building",
      capacity: 200,
      attribute_id: attribute.id,
      order: 1,
    },
  });

  const classroomBlock: Block = await prisma.block.create({
    data: {
      name: "Room 101",
      description: "First floor room",
      capacity: 30,
      parent_id: mainBlock.id,
      attribute_id: attribute.id,
      order: 2,
    },
  });

  const seatBlock: Block = await prisma.block.create({
    data: {
      name: "Bed A1",
      description: "Front-left bed",
      capacity: 1,
      parent_id: classroomBlock.id,
      attribute_id: attribute.id,
      order: 1,
    },
  });

  const form: Form = await prisma.form.create({
    data: {
      name: "Registration",
      description: "Register for event",
      event_id: event.id,
      is_editable: true,
    },
  });

  const formDefinition: FormDefinition = await prisma.formDefinition.create({
    data: {
      attribute_id: attribute.id,
      form_id: form.id,
      is_required: true,
      order: 1,
    },
  });

  const email: Email = await prisma.email.create({
    data: {
      event_id: event.id,
      name: "Welcome",
      content: "Welcome to the event!",
      trigger: "on_register",
      form_id: form.id,
      trigger_value: null,
      trigger_value_2: null,
    },
  });

  const participant: Participant = await prisma.participant.create({
    data: {
      email: "participant@example.com",
      event_id: event.id,
    },
  });

  const participantAttribute: ParticipantAttribute =
    await prisma.participantAttribute.create({
      data: {
        participant_id: participant.id,
        attribute_id: attribute.id,
        value: "M",
      },
    });

  const participantForm: ParticipantForm = await prisma.participantForm.create({
    data: {
      participant_id: participant.id,
      form_id: form.id,
      email_id: email.id,
    },
  });

  const participantEmail: ParticipantEmail =
    await prisma.participantEmail.create({
      data: {
        participant_id: participant.id,
        email_id: email.id,
        send_at: new Date(),
        send_by: "system",
        status: "sent",
      },
    });

  const participantAttributeLog: ParticipantAttributeLog =
    await prisma.participantAttributeLog.create({
      data: {
        participant_id: participant.id,
        triggered_by: "system",
        triggered_id: admin.id,
        attribute_id: attribute.id,
        before: null,
        after: "M",
      },
    });

  await prisma.event.update({
    where: { id: event.id },
    data: { register_form_id: form.id },
  });

  console.warn("Seed complete!", {
    adminId: admin.id,
    eventId: event.id,
    formId: form.id,
    formDefinitionId: formDefinition.id,
    mainBlockId: mainBlock.id,
    classroomBlockId: classroomBlock.id,
    seatBlockId: seatBlock.id,
    participantId: participant.id,
    participantAttributeId: participantAttribute.id,
    participantFormId: participantForm.id,
    participantEmailId: participantEmail.id,
    participantAttributeLogId: participantAttributeLog.id,
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
