import { randomUUID } from "node:crypto";

import { getJsonObject } from "src/common/utils/prisma.utility";
import type { Prisma } from "src/generated/prisma/client";
import { AttributeType } from "src/generated/prisma/enums";

import { Injectable } from "@nestjs/common";

export type EmailTemplateForParsing = Prisma.EmailTemplateGetPayload<{
  include: {
    event: {
      include: {
        attributes: { include: { blocks: true } };
        forms: true;
      };
    };
  };
}>;

export interface ParticipantForParsing {
  uuid: string;
  email: string;
  createdAt: Date;
  updatedAt: Date;
  attributes: {
    attributeUuid: string;
    value: Prisma.JsonValue | null;
  }[];
}

export interface ParsedEmailAttachment {
  content: Buffer;
  encoding: "base64";
  filename: string;
  cid: string;
  contentType: string;
}

export interface ParsedEmailContent {
  html: string;
  attachments: ParsedEmailAttachment[];
}

@Injectable()
export class EmailContentParserService {
  private getStringArray(
    value: Prisma.JsonValue | null,
    key: string,
  ): string[] {
    const config = getJsonObject(value);
    if (config == null) {
      return [];
    }

    const rawValues = config[key];
    if (!Array.isArray(rawValues)) {
      return [];
    }

    return rawValues.filter(
      (rawValue): rawValue is string =>
        typeof rawValue === "string" && rawValue.trim().length > 0,
    );
  }

  private stringifyJsonValue(value: Prisma.JsonValue | null): string {
    if (value == null) {
      return "";
    }

    if (typeof value === "string") {
      return value;
    }

    if (typeof value === "number" || typeof value === "boolean") {
      return String(value);
    }

    return JSON.stringify(value);
  }

  private escapeHtml(string_: string): string {
    return string_
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#39;");
  }

  parseEmailContent(
    emailTemplate: EmailTemplateForParsing,
    participant: ParticipantForParsing,
  ): ParsedEmailContent {
    let content = emailTemplate.content;
    const tagRegex = /<span[^>]*data-id="([^"]+)"[^>]*>.*?<\/span>/g;

    // static tags replacement
    content = content.replaceAll(tagRegex, (_match: string, dataId: string) => {
      switch (dataId) {
        case "/event_name": {
          return this.escapeHtml(emailTemplate.event.name);
        }
        case "/event_start_date": {
          return emailTemplate.event.startDate.toISOString();
        }
        case "/event_end_date": {
          return emailTemplate.event.endDate.toISOString();
        }
        case "/event_slug": {
          return emailTemplate.event.slug;
        }
        case "/event_primary_color": {
          return emailTemplate.event.primaryColor ?? "";
        }
        case "/event_location": {
          return this.escapeHtml(emailTemplate.event.location ?? "");
        }
        case "/participant_id": {
          return participant.uuid;
        }
        case "/participant_email": {
          return this.escapeHtml(participant.email);
        }
        case "/participant_created_at": {
          return participant.createdAt.toISOString();
        }
        case "/participant_updated_at": {
          return participant.updatedAt.toISOString();
        }
        default: {
          return _match;
        }
      }
    });

    // dynamic tags replacement
    // /participant_{attributeUUID} is replaced with that attribute's value for this participant
    for (const participantAttribute of participant.attributes) {
      const attribute = emailTemplate.event.attributes.find(
        (attribute_) => attribute_.uuid === participantAttribute.attributeUuid,
      );

      if (attribute != null) {
        const dynamicTag = `<span data-id="/participant_${attribute.uuid}"></span>`;
        const rawValue = participantAttribute.value;

        if (attribute.type === AttributeType.multiSelect) {
          const selectedValues = Array.isArray(rawValue)
            ? rawValue.filter(
                (value): value is string => typeof value === "string",
              )
            : [];
          const optionNames = this.getStringArray(attribute.config, "options");

          const replacement =
            optionNames.length > 0 && selectedValues.length > 0
              ? optionNames
                  .filter((option) => selectedValues.includes(option))
                  .join(", ")
              : this.stringifyJsonValue(rawValue);

          content = content.replaceAll(
            new RegExp(dynamicTag, "g"),
            this.escapeHtml(replacement),
          );
        } else if (attribute.type === AttributeType.block) {
          const selectedUuids = Array.isArray(rawValue)
            ? rawValue.filter(
                (value): value is string => typeof value === "string",
              )
            : typeof rawValue === "string"
              ? [rawValue]
              : [];
          const blockNames = selectedUuids
            .map(
              (blockUuid) =>
                attribute.blocks.find((block) => block.uuid === blockUuid)
                  ?.name,
            )
            .filter((name): name is string => name != null);

          content = content.replaceAll(
            new RegExp(dynamicTag, "g"),
            this.escapeHtml(blockNames.join(", ")),
          );
        } else {
          content = content.replaceAll(
            new RegExp(dynamicTag, "g"),
            this.escapeHtml(this.stringifyJsonValue(rawValue)),
          );
        }
      }
    }

    // form links replacement eg /form_{formUuid} will be replaced with a link
    // to {APP_DOMAIN}/{eventSlug}/{formUuid}/{participantUuid}
    const formLinkRegex = /<span[^>]*data-id="\/form_([^"]+)"[^>]*><\/span>/g;
    content = content.replaceAll(
      formLinkRegex,
      (match: string, formUuid: string) => {
        const form = emailTemplate.event.forms.find((f) => f.uuid === formUuid);
        if (form == null) {
          return match; // if form not found, return the original tag
        }

        const appDomain = process.env.APP_DOMAIN ?? "http://localhost:3000";
        const formUrl = `${appDomain}/${emailTemplate.event.slug}/${form.uuid}/${participant.uuid}`;
        return `<a href="${formUrl}">${this.escapeHtml(form.name)}</a>`;
      },
    );

    // inline base64 images replacement -> extracted as cid attachments
    const attachments: ParsedEmailAttachment[] = [];
    content = content.replaceAll(
      /data:image\/(\w+);base64,([^"')\s]+)/g,
      (_match: string, format: string, base64: string) => {
        const cid = randomUUID();
        attachments.push({
          content: Buffer.from(base64, "base64"),
          encoding: "base64",
          filename: `${cid}.${format}`,
          cid,
          contentType: `image/${format}`,
        });
        return `cid:${cid}`;
      },
    );

    return { html: content, attachments };
  }
}
