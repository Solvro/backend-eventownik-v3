import { normalizeParticipantAttributeValue } from "src/attributes/attribute-value-normalizer";
import {
  AttributeType,
  EmailTrigger,
  EventLinkType,
  OpenCondition,
  PermissionType,
  Prisma,
} from "src/generated/prisma/client";
import type { PrismaService } from "src/prisma/prisma.service";

import { LEGACY_TAG_CUTOFF, rewriteContent, rewriteSchema } from "./email-tags";
import type { TagContext, TagReport } from "./email-tags";
import { IdRegistry } from "./id-registry";
import {
  StructuralError,
  buildAttributeConfig,
  mapAdminType,
  mapAttributeType,
  mapEmailStatus,
  mapEmailTrigger,
  mapPermission,
  parseLink,
} from "./mapping";
import type {
  BlobRef,
  Issue,
  LedgerEntry,
  Plan,
  PlannedEntity,
  PlannedRow,
  V2Data,
} from "./types";
import { collectV2Values } from "./values";

type RowBody = Omit<PlannedRow, "sourceKey" | "targetId">;

interface AttributeInfo {
  targetId: string;
  eventId: number;
  type: AttributeType;
  config: Record<string, unknown>;
}

function groupBy<T>(items: T[], keyOf: (item: T) => string) {
  const groups = new Map<string, T[]>();
  for (const item of items) {
    const key = keyOf(item);
    groups.set(key, [...(groups.get(key) ?? []), item]);
  }
  return groups;
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

export async function buildPlan(
  v2: V2Data,
  ledger: LedgerEntry[],
  now: Date,
): Promise<Plan> {
  const registry = new IdRegistry();
  for (const entry of ledger) {
    registry.preload(entry.entity, entry.sourceKey, entry.targetId);
  }

  const plan: Plan = {
    entities: [],
    skippedTargets: new Set(),
    referencedFiles: [],
    exceptions: [],
    warnings: [],
    fatal: [],
  };

  const warn = (entity: string, key: string, message: string) =>
    plan.warnings.push({ entity, key, message });

  const entityOf = (name: string, prunable = true) => {
    const entity: PlannedEntity = {
      name,
      rows: [],
      seenKeys: new Set(),
      prunable,
    };
    plan.entities.push(entity);

    const add = async (
      sourceKey: string,
      targetId: string,
      build: () => RowBody | null | Promise<RowBody | null>,
    ) => {
      entity.seenKeys.add(sourceKey);
      try {
        const body = await build();
        if (body !== null) {
          entity.rows.push({ sourceKey, targetId, ...body });
        }
      } catch (error) {
        const issue: Issue = {
          entity: name,
          key: sourceKey,
          message: errorMessage(error),
        };
        if (error instanceof StructuralError) {
          plan.fatal.push(issue);
        } else {
          plan.exceptions.push(issue);
        }
        plan.skippedTargets.add(targetId);
      }
    };
    return { entity, add };
  };

  const stamps = (row: {
    created_at: Date | null;
    updated_at: Date | null;
  }) => ({
    createdAt: row.created_at ?? now,
    updatedAt: row.updated_at ?? row.created_at ?? now,
  });

  const referenceFile = (file: BlobRef) => plan.referencedFiles.push(file);

  const assignFromSlug = (entity: string, key: string, slug: string) => {
    const targetId = registry.assign(entity, key, slug);
    if (targetId !== slug.trim().toLowerCase()) {
      warn(
        entity,
        key,
        `slug "${slug}" not usable as uuid, generated ${targetId}`,
      );
    }
    return targetId;
  };

  const admins = entityOf("Admin");
  for (const admin of v2.admins) {
    const key = String(admin.id);
    const targetId = registry.assign("Admin", key);
    await admins.add(key, targetId, () => ({
      refs: [],
      payload: {
        firstName: admin.first_name,
        lastName: admin.last_name,
        password: admin.password,
        email: admin.email,
        type: mapAdminType(admin.type),
        active: admin.active,
        ...stamps(admin),
      },
    }));
  }

  const events = entityOf("Event");
  for (const event of v2.events) {
    const key = String(event.id);
    const targetId = registry.assign("Event", key);
    await events.add(key, targetId, () => {
      const organizerUuid =
        event.organizer_id === null
          ? null
          : registry.require("Admin", String(event.organizer_id));
      if (event.photo_url !== null && event.photo_url !== "") {
        referenceFile({ bucket: "events", key: event.photo_url });
      }
      const isActive = event.is_active ?? false;
      return {
        refs: organizerUuid === null ? [] : [organizerUuid],
        payload: {
          name: event.name,
          slug: event.slug,
          description: event.description,
          startDate: event.start_date,
          endDate: event.end_date,
          primaryColor: event.primary_color,
          organizerName: event.organizer,
          organizerUuid,
          participantsLimit: event.participants_count,
          photoKey: event.photo_url === "" ? null : event.photo_url,
          location: event.location,
          contactEmail: event.contact_email,
          isPublic: isActive,
          ...stamps(event),
        },
        insertOnly: {
          isVerified: isActive,
          verifiedAt: isActive ? now : null,
        },
        archived: { lat: event.lat, long: event.long },
      };
    });
  }

  const eventLinks = entityOf("EventLink");
  for (const event of v2.events) {
    const eventTarget = registry.require("Event", String(event.id));
    const links = [
      ...[...new Set(event.social_media_links)].map((url) => ({
        key: `${String(event.id)}:social:${url}`,
        raw: url,
        type: EventLinkType.general,
      })),
      ...(event.terms_link === null
        ? []
        : [
            {
              key: `${String(event.id)}:terms`,
              raw: event.terms_link,
              type: EventLinkType.policy,
            },
          ]),
    ].filter((link) => link.raw.trim() !== "");

    for (const link of links) {
      const { url, label } = parseLink(link.raw);
      const targetId = registry.assign("EventLink", link.key);
      await eventLinks.add(link.key, targetId, () => ({
        refs: [eventTarget],
        payload: {
          eventUuid: eventTarget,
          url,
          type: link.type,
          label,
          ...stamps(event),
        },
      }));
    }
  }

  const permissionsById = new Map(
    v2.permissions.map((permission) => [permission.id, permission]),
  );
  const eventPermissions = entityOf("EventPermission");
  for (const grant of v2.adminPermissions) {
    const key = `${String(grant.event_id)}:${String(grant.admin_id)}:${String(grant.permission_id)}`;
    const targetId = registry.assign("EventPermission", key);
    await eventPermissions.add(key, targetId, () => {
      const permission = permissionsById.get(grant.permission_id);
      if (permission === undefined) {
        throw new Error(`permission ${String(grant.permission_id)} not found`);
      }
      const mapped = mapPermission(permission.action, permission.subject);
      if (mapped !== PermissionType.MANAGE_ALL) {
        warn(
          "EventPermission",
          key,
          `admin ${String(grant.admin_id)} has ${permission.action}/${permission.subject} on event ${String(grant.event_id)} instead of manage/all`,
        );
      }
      const eventUuid = registry.require("Event", String(grant.event_id));
      const adminUuid = registry.require("Admin", String(grant.admin_id));
      return {
        refs: [eventUuid, adminUuid],
        payload: { eventUuid, adminUuid, permission: mapped },
      };
    });
  }

  const blockCountByAttribute = new Map<number, number>();
  for (const block of v2.blocks) {
    if (block.attribute_id !== null && !block.is_root_block) {
      blockCountByAttribute.set(
        block.attribute_id,
        (blockCountByAttribute.get(block.attribute_id) ?? 0) + 1,
      );
    }
  }

  const attributeInfo = new Map<number, AttributeInfo>();
  const attributes = entityOf("Attribute");
  for (const attribute of v2.attributes) {
    const key = String(attribute.id);
    const targetId = registry.assign("Attribute", key);
    await attributes.add(key, targetId, () => {
      const type = mapAttributeType(attribute.type);
      const eventUuid = registry.require("Event", String(attribute.event_id));
      const config = buildAttributeConfig(
        attribute,
        type,
        blockCountByAttribute.get(attribute.id) ?? 0,
      );
      attributeInfo.set(attribute.id, {
        targetId,
        eventId: attribute.event_id,
        type,
        config,
      });
      return {
        refs: [eventUuid],
        payload: {
          eventUuid,
          type,
          name: attribute.name ?? "",
          order: attribute.order,
          showInList: attribute.show_in_list ?? true,
          config,
          ...stamps(attribute),
        },
        archived: {
          slug: attribute.slug,
          isSensitiveData: attribute.is_sensitive_data,
          reason: attribute.reason,
        },
      };
    });
  }

  const blocksById = new Map(v2.blocks.map((block) => [block.id, block]));
  const blockDepth = (id: number): number => {
    let depth = 0;
    let current = blocksById.get(id);
    while (current?.parent_id != null && depth <= v2.blocks.length) {
      depth += 1;
      current = blocksById.get(current.parent_id);
    }
    return depth;
  };

  const blocks = entityOf("Block");
  const blockUuidsByAttribute = new Map<string, Set<string>>();
  const sortedBlocks = v2.blocks.toSorted(
    (a, b) => blockDepth(a.id) - blockDepth(b.id) || a.id - b.id,
  );
  for (const block of sortedBlocks) {
    const key = String(block.id);
    const targetId = registry.assign("Block", key);
    await blocks.add(key, targetId, () => {
      const parentUuid =
        block.parent_id === null
          ? null
          : registry.require("Block", String(block.parent_id));
      const attributeUuid =
        block.attribute_id === null
          ? null
          : registry.require("Attribute", String(block.attribute_id));
      if (attributeUuid !== null) {
        const known = blockUuidsByAttribute.get(attributeUuid) ?? new Set();
        known.add(targetId);
        blockUuidsByAttribute.set(attributeUuid, known);
      }
      return {
        refs: [
          ...(parentUuid === null ? [] : [parentUuid]),
          ...(attributeUuid === null ? [] : [attributeUuid]),
        ],
        payload: {
          name: block.name ?? "",
          description: block.description,
          capacity: block.capacity,
          order: block.order,
          parentUuid,
          attributeUuid,
          isRootBlock: block.is_root_block,
          ...stamps(block),
        },
      };
    });
  }

  const definitionsByForm = groupBy(v2.formDefinitions, (definition) =>
    String(definition.form_id),
  );
  const forms = entityOf("Form");
  for (const form of v2.forms) {
    const key = String(form.id);
    const targetId = assignFromSlug("Form", key, form.slug);
    await forms.add(key, targetId, () => {
      const eventUuid =
        form.event_id === null
          ? null
          : registry.require("Event", String(form.event_id));
      const definitions = definitionsByForm.get(key) ?? [];
      return {
        refs: eventUuid === null ? [] : [eventUuid],
        payload: {
          name: form.name,
          description: form.description,
          eventUuid,
          isOpen: form.is_open ?? false,
          openCondition: OpenCondition.MANUAL,
          openDate: form.start_date,
          closeDate: form.end_date,
          isEditable:
            definitions.length > 0 &&
            definitions.every((definition) => definition.is_editable),
          order: form.order,
          ...stamps(form),
        },
        archived: {
          slug: form.slug,
          submissionsLeft: form.submissions_left,
        },
      };
    });
  }

  const registerForms = entityOf("EventRegisterForm", false);
  const firstFormByEvent = groupBy(
    v2.forms.filter((form) => form.is_first_form === true),
    (form) => String(form.event_id),
  );
  for (const [eventKey, firstForms] of firstFormByEvent) {
    const form = firstForms[0];
    const eventTarget = registry.get("Event", eventKey);
    if (eventTarget === undefined) {
      continue;
    }
    if (firstForms.length > 1) {
      warn(
        "EventRegisterForm",
        eventKey,
        `event has ${String(firstForms.length)} first forms, using form ${String(form.id)}`,
      );
    }
    await registerForms.add(eventKey, eventTarget, () => {
      const formUuid = registry.require("Form", String(form.id));
      return {
        refs: [eventTarget, formUuid],
        payload: { registerFormUuid: formUuid },
      };
    });
  }

  const formDefinitions = entityOf("FormDefinition");
  for (const definition of v2.formDefinitions) {
    const key = String(definition.id);
    const targetId = registry.assign("FormDefinition", key);
    await formDefinitions.add(key, targetId, () => {
      const formUuid = registry.require("Form", String(definition.form_id));
      const attributeUuid = registry.require(
        "Attribute",
        String(definition.attribute_id),
      );
      return {
        refs: [formUuid, attributeUuid],
        payload: {
          formUuid,
          attributeUuid,
          isRequired: definition.is_required,
          order: definition.order,
          ...stamps(definition),
        },
      };
    });
  }

  const slugMapsByEvent = (
    items: { event_id: number | null; slug: string | null; uuid: string }[],
  ) => {
    const maps = new Map<number, Map<string, string>>();
    for (const { event_id: eventId, slug, uuid } of items) {
      if (eventId === null || slug === null || slug === "") {
        continue;
      }
      const map = maps.get(eventId) ?? new Map<string, string>();
      map.set(slug, uuid);
      maps.set(eventId, map);
    }
    return maps;
  };
  const attributeUuidsByEvent = slugMapsByEvent(
    v2.attributes.flatMap((attribute) => {
      const info = attributeInfo.get(attribute.id);
      return info === undefined
        ? []
        : [
            {
              event_id: attribute.event_id,
              slug: attribute.slug,
              uuid: info.targetId,
            },
          ];
    }),
  );
  const formUuidsByEvent = slugMapsByEvent(
    v2.forms.flatMap((form) => {
      const uuid = registry.get("Form", String(form.id));
      return uuid === undefined
        ? []
        : [{ event_id: form.event_id, slug: form.slug, uuid }];
    }),
  );

  const emailTemplates = entityOf("EmailTemplate");
  for (const email of v2.emails) {
    const key = String(email.id);
    const targetId = registry.assign("EmailTemplate", key);
    await emailTemplates.add(key, targetId, () => {
      const trigger = mapEmailTrigger(email.trigger);
      const eventUuid = registry.require("Event", String(email.event_id));
      let triggerConfig: Record<string, unknown> = {};

      if (trigger === EmailTrigger.FORM_FILLED) {
        triggerConfig = {
          formUuid: registry.require("Form", String(email.trigger_value)),
        };
      } else if (trigger === EmailTrigger.ATTRIBUTE_CHANGED) {
        const attribute = attributeInfo.get(Number(email.trigger_value));
        if (attribute === undefined) {
          throw new Error(
            `trigger attribute ${String(email.trigger_value)} not found`,
          );
        }
        const expectedValue =
          attribute.type === AttributeType.block &&
          email.trigger_value_2 !== null
            ? (registry.get("Block", email.trigger_value_2) ??
              email.trigger_value_2)
            : email.trigger_value_2;
        triggerConfig = { attributeUuid: attribute.targetId, expectedValue };
      }

      const tagContext: TagContext = {
        attributes:
          attributeUuidsByEvent.get(email.event_id ?? -1) ?? new Map(),
        forms: formUuidsByEvent.get(email.event_id ?? -1) ?? new Map(),
        legacyFormUuid:
          email.form_id === null
            ? null
            : (registry.get("Form", String(email.form_id)) ?? null),
        legacy:
          email.created_at !== null && email.created_at < LEGACY_TAG_CUTOFF,
      };
      const tagReport: TagReport = { unresolved: new Set(), converted: 0 };

      let schema: unknown = null;
      if (email.schema !== null && email.schema !== "") {
        try {
          schema = rewriteSchema(
            JSON.parse(email.schema),
            tagContext,
            tagReport,
          );
        } catch {
          warn("EmailTemplate", key, "schema is not valid JSON, dropped");
        }
      }
      const content = rewriteContent(email.content, tagContext, tagReport);

      if (tagReport.converted > 0) {
        warn(
          "EmailTemplate",
          key,
          `${String(tagReport.converted)} plain-text tags converted`,
        );
      }
      for (const tag of tagReport.unresolved) {
        warn("EmailTemplate", key, `unresolved tag ${tag} left unchanged`);
      }

      return {
        refs: [eventUuid],
        payload: {
          name: email.name,
          content,
          schema,
          trigger,
          triggerConfig,
          order: email.order,
          eventUuid,
          ...stamps(email),
        },
        archived: { formId: email.form_id },
      };
    });
  }

  const participants = entityOf("Participant");
  const participantByEmail = new Map<string, number>();
  const participantEvent = new Map<number, number>();
  for (const participant of v2.participants) {
    const key = String(participant.id);
    const targetId = assignFromSlug("Participant", key, participant.slug);
    await participants.add(key, targetId, () => {
      const eventUuid = registry.require("Event", String(participant.event_id));
      participantEvent.set(participant.id, participant.event_id);
      const emailKey = `${String(participant.event_id)}\u0000${participant.email}`;
      const firstId = participantByEmail.get(emailKey);
      if (firstId !== undefined) {
        throw new Error(
          `duplicate email in event ${String(participant.event_id)}, already migrated as participant ${String(firstId)}`,
        );
      }
      participantByEmail.set(emailKey, participant.id);
      return {
        refs: [eventUuid],
        payload: {
          email: participant.email,
          eventUuid,
          ...stamps(participant),
        },
        archived: { slug: participant.slug },
      };
    });
  }

  const blockStub = {
    block: {
      // eslint-disable-next-line @typescript-eslint/promise-function-async
      count: ({
        where,
      }: {
        where: { uuid: { in: string[] }; attributeUuid: string };
      }) =>
        Promise.resolve(
          where.uuid.in.filter(
            (uuid) =>
              blockUuidsByAttribute.get(where.attributeUuid)?.has(uuid) ===
              true,
          ).length,
        ),
    },
  } as unknown as PrismaService;

  const participantAttributes = entityOf("ParticipantAttribute");
  const valueGroups = groupBy(
    v2.participantAttributes,
    (row) => `${String(row.participant_id)}:${String(row.attribute_id)}`,
  );
  for (const [key, rows] of valueGroups) {
    const targetId = registry.assign("ParticipantAttribute", key);
    const first = rows[0];
    await participantAttributes.add(key, targetId, async () => {
      const participantUuid = registry.require(
        "Participant",
        String(first.participant_id),
      );
      const attribute = attributeInfo.get(first.attribute_id);
      if (attribute === undefined) {
        throw new Error(`attribute ${String(first.attribute_id)} not found`);
      }
      if (participantEvent.get(first.participant_id) !== attribute.eventId) {
        throw new Error("attribute belongs to a different event");
      }

      let input = collectV2Values(
        attribute.type,
        rows.map((row) => row.value),
      );
      if (input !== null && attribute.type === AttributeType.block) {
        input = (input as string[]).map((blockId) => {
          const block = blocksById.get(Number(blockId));
          if (block?.attribute_id !== first.attribute_id) {
            throw new Error(
              `block ${blockId} does not belong to attribute ${String(first.attribute_id)}`,
            );
          }
          return registry.require("Block", blockId);
        });
      }

      const value = await normalizeParticipantAttributeValue(
        blockStub,
        {
          attributeUuid: attribute.targetId,
          type: attribute.type,
          config: attribute.config as Prisma.JsonObject,
        },
        input,
      );
      if (value === Prisma.JsonNull) {
        return null;
      }

      if (
        typeof value === "string" &&
        (attribute.type === AttributeType.file ||
          attribute.type === AttributeType.drawing)
      ) {
        referenceFile({ bucket: "forms", key: value });
      }

      const timestamps = rows.map((row) => stamps(row));
      return {
        refs: [participantUuid, attribute.targetId],
        payload: {
          participantUuid,
          attributeUuid: attribute.targetId,
          value,
          createdAt: new Date(
            Math.min(...timestamps.map((stamp) => stamp.createdAt.getTime())),
          ),
          updatedAt: new Date(
            Math.max(...timestamps.map((stamp) => stamp.updatedAt.getTime())),
          ),
        },
      };
    });
  }

  const emailStatuses = entityOf("ParticipantEmailStatus");
  for (const status of v2.participantEmails) {
    const key = String(status.id);
    const targetId = registry.assign("ParticipantEmailStatus", key);
    await emailStatuses.add(key, targetId, () => {
      const participantUuid = registry.require(
        "Participant",
        String(status.participant_id),
      );
      const emailUuid = registry.require(
        "EmailTemplate",
        String(status.email_id),
      );
      const sendAt = status.send_at ?? status.created_at;
      if (sendAt === null) {
        throw new Error("send_at and created_at are both empty");
      }
      return {
        refs: [participantUuid, emailUuid],
        payload: {
          participantUuid,
          emailUuid,
          status: mapEmailStatus(status.status),
          sendAt,
          sendBy: status.send_by,
          ...stamps(status),
        },
      };
    });
  }

  return plan;
}
