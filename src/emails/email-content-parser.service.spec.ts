import { AttributeType } from "src/generated/prisma/enums";

import type { ConfigService } from "@nestjs/config";

import type {
  EmailTemplateForParsing,
  ParticipantForParsing,
} from "./email-content-parser.service";
import { EmailContentParserService } from "./email-content-parser.service";

describe("EmailContentParserService", () => {
  const attributeUuid = "11111111-1111-4111-8111-111111111111";
  const formUuid = "22222222-2222-4222-8222-222222222222";
  const participantUuid = "33333333-3333-4333-8333-333333333333";

  const config = {
    getOrThrow: jest.fn().mockReturnValue("https://frontend.test"),
  } as unknown as ConfigService;
  const service = new EmailContentParserService(config);

  function parse(content: string, attributeValue = "XL") {
    const template = {
      content,
      event: {
        name: "Event",
        slug: "event-slug",
        attributes: [
          {
            uuid: attributeUuid,
            type: AttributeType.text,
            config: {},
            blocks: [],
          },
        ],
        forms: [{ uuid: formUuid, name: "Survey" }],
      },
    } as unknown as EmailTemplateForParsing;
    const participant: ParticipantForParsing = {
      uuid: participantUuid,
      email: "person@example.com",
      createdAt: new Date("2025-01-01"),
      updatedAt: new Date("2025-01-01"),
      attributes: [{ attributeUuid, value: attributeValue }],
    };
    return service.parseEmailContent(template, participant).html;
  }

  describe("participant attribute tags", () => {
    it("replaces an empty tag", () => {
      const html = parse(
        `<p><span data-id="/participant_${attributeUuid}"></span></p>`,
      );

      expect(html).toBe("<p>XL</p>");
    });

    it("replaces a mention span that carries a label and extra attributes", () => {
      const html = parse(
        `<p><span class="mention" data-type="mention" data-id="/participant_${attributeUuid}">Size</span></p>`,
      );

      expect(html).toBe("<p>XL</p>");
    });

    it("inserts replacement values literally", () => {
      const html = parse(
        `<span data-id="/participant_${attributeUuid}">Size</span>`,
        "$& $1",
      );

      expect(html).toBe("$&amp; $1");
    });

    it("leaves spans for other attributes untouched", () => {
      const other = `<span data-id="/participant_44444444-4444-4444-8444-444444444444">Other</span>`;

      expect(parse(other)).toBe(other);
    });
  });

  describe("form link tags", () => {
    const link = `<a href="https://frontend.test/event-slug/${formUuid}/${participantUuid}">Survey</a>`;

    it("replaces an empty tag with a link", () => {
      const html = parse(`<span data-id="/form_${formUuid}"></span>`);

      expect(html).toBe(link);
    });

    it("replaces a mention span that carries a label", () => {
      const html = parse(
        `<span class="mention" data-id="/form_${formUuid}">Fill the survey</span>`,
      );

      expect(html).toBe(link);
    });

    it("keeps the span when the form does not belong to the event", () => {
      const unknown = `<span data-id="/form_55555555-5555-4555-8555-555555555555">Label</span>`;

      expect(parse(unknown)).toBe(unknown);
    });
  });
});
