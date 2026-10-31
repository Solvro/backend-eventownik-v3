import { buildPlan } from "./plan";
import type { V2Data } from "./types";

const at = new Date("2026-01-01T00:00:00Z");
const stamps = { created_at: at, updated_at: at };

function fixture(overrides: Partial<V2Data> = {}): V2Data {
  return {
    admins: [
      {
        id: 1,
        first_name: "A",
        last_name: "B",
        password: "$scrypt$x",
        email: "a@x.pl",
        type: "superadmin",
        active: true,
        ...stamps,
      },
    ],
    permissions: [
      { id: 1, action: "manage", subject: "all" },
      { id: 2, action: "manage", subject: "form" },
    ],
    adminPermissions: [
      { id: 1, event_id: 1, permission_id: 1, admin_id: 1 },
      { id: 2, event_id: 1, permission_id: 2, admin_id: 1 },
    ],
    events: [
      {
        id: 1,
        organizer_id: 1,
        name: "Conf",
        description: null,
        slug: "conf",
        start_date: at,
        end_date: at,
        lat: 1,
        long: 2,
        primary_color: null,
        organizer: "Org",
        participants_count: 50,
        photo_url: "p.png",
        social_media_links: ["https://a.pl"],
        terms_link: "https://terms.pl",
        location: null,
        contact_email: null,
        is_active: true,
        ...stamps,
      },
    ],
    attributes: [
      {
        id: 1,
        name: "Langs",
        slug: "langs",
        event_id: 1,
        show_in_list: true,
        options: '["pl","en"]',
        type: "multiselect",
        order: 0,
        is_sensitive_data: false,
        reason: null,
        allow_other: false,
        is_multiple: false,
        max_selections: 2,
        ...stamps,
      },
    ],
    blocks: [],
    forms: [
      {
        id: 1,
        name: "Register",
        slug: "11111111-1111-4111-8111-111111111111",
        start_date: at,
        end_date: null,
        is_open: true,
        is_first_form: true,
        description: null,
        event_id: 1,
        submissions_left: 5,
        order: 0,
        ...stamps,
      },
    ],
    formDefinitions: [],
    emails: [],
    participants: [
      {
        id: 1,
        email: "p@x.pl",
        event_id: 1,
        slug: "22222222-2222-4222-8222-222222222222",
        ...stamps,
      },
      { id: 2, email: "p@x.pl", event_id: 1, slug: "dup", ...stamps },
    ],
    participantAttributes: [
      { id: 1, participant_id: 1, attribute_id: 1, value: "pl,en", ...stamps },
    ],
    participantEmails: [],
    ...overrides,
  };
}

const rowsOf = (plan: Awaited<ReturnType<typeof buildPlan>>, name: string) =>
  plan.entities.find((entity) => entity.name === name)?.rows ?? [];

describe("buildPlan", () => {
  it("maps events, links, permissions and archives dropped fields", async () => {
    const plan = await buildPlan(fixture(), [], at);
    const [event] = rowsOf(plan, "Event");

    expect(event.payload).toMatchObject({
      isPublic: true,
      participantsLimit: 50,
      photoKey: "p.png",
      organizerName: "Org",
    });
    expect(event.insertOnly).toMatchObject({ isVerified: true });
    expect(event.archived).toEqual({ lat: 1, long: 2 });
    expect(rowsOf(plan, "EventLink").map((row) => row.payload.type)).toEqual([
      "general",
      "policy",
    ]);
    expect(plan.referencedFiles).toContainEqual({
      bucket: "events",
      key: "p.png",
    });
    expect(plan.warnings.map((issue) => issue.message)).toContain(
      "admin 1 has manage/form on event 1 instead of manage/all",
    );
  });

  it("reuses the form slug as uuid and registers the first form", async () => {
    const plan = await buildPlan(fixture(), [], at);
    const [form] = rowsOf(plan, "Form");
    const [register] = rowsOf(plan, "EventRegisterForm");

    expect(form.targetId).toBe("11111111-1111-4111-8111-111111111111");
    expect(form.payload).toMatchObject({
      openCondition: "MANUAL",
      isOpen: true,
      isEditable: false,
    });
    expect(form.archived).toMatchObject({ submissionsLeft: 5 });
    expect(register.payload).toEqual({ registerFormUuid: form.targetId });
  });

  it("skips duplicate participant emails and their attribute values", async () => {
    const plan = await buildPlan(
      fixture({
        participantAttributes: [
          {
            id: 1,
            participant_id: 1,
            attribute_id: 1,
            value: "pl,en",
            ...stamps,
          },
          {
            id: 2,
            participant_id: 2,
            attribute_id: 1,
            value: "pl",
            ...stamps,
          },
        ],
      }),
      [],
      at,
    );

    expect(rowsOf(plan, "Participant")).toHaveLength(1);
    expect(plan.exceptions.map((issue) => issue.key)).toEqual(["2"]);
    const duplicateRow = rowsOf(plan, "ParticipantAttribute").find(
      (row) => row.sourceKey === "2:1",
    );
    expect(plan.skippedTargets.has(duplicateRow?.refs[0] ?? "")).toBe(true);
  });

  it("converts multiSelect values to arrays and rejects unknown options", async () => {
    const plan = await buildPlan(
      fixture({
        participantAttributes: [
          {
            id: 1,
            participant_id: 1,
            attribute_id: 1,
            value: "pl,en",
            ...stamps,
          },
        ],
      }),
      [],
      at,
    );
    expect(rowsOf(plan, "ParticipantAttribute")[0].payload.value).toEqual([
      "pl",
      "en",
    ]);

    const invalid = await buildPlan(
      fixture({
        participantAttributes: [
          { id: 1, participant_id: 1, attribute_id: 1, value: "xx", ...stamps },
        ],
      }),
      [],
      at,
    );
    expect(rowsOf(invalid, "ParticipantAttribute")).toHaveLength(0);
    expect(invalid.exceptions).toHaveLength(2);
  });

  it("flags unknown attribute types as fatal", async () => {
    const base = fixture();
    const plan = await buildPlan(
      fixture({ attributes: [{ ...base.attributes[0], type: "hologram" }] }),
      [],
      at,
    );
    expect(plan.fatal).toHaveLength(1);
  });

  it("reuses ledger ids", async () => {
    const plan = await buildPlan(
      fixture(),
      [
        {
          entity: "Event",
          sourceKey: "1",
          targetId: "99999999-9999-4999-8999-999999999999",
          payloadHash: "x",
        },
      ],
      at,
    );
    expect(rowsOf(plan, "Event")[0].targetId).toBe(
      "99999999-9999-4999-8999-999999999999",
    );
  });
});
