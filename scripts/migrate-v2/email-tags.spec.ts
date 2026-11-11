import { rewriteContent, rewriteSchema } from "./email-tags";
import type { TagContext, TagReport } from "./email-tags";

const ATTRIBUTE_UUID = "11111111-1111-4111-8111-111111111111";
const LONG_ATTRIBUTE_UUID = "22222222-2222-4222-8222-222222222222";
const FORM_UUID = "33333333-3333-4333-8333-333333333333";

const context = (overrides: Partial<TagContext> = {}): TagContext => ({
  attributes: new Map([
    ["imie", ATTRIBUTE_UUID],
    ["imie-drugie", LONG_ATTRIBUTE_UUID],
  ]),
  forms: new Map([["form-slug", FORM_UUID]]),
  legacyFormUuid: null,
  legacy: false,
  ...overrides,
});

const report = (): TagReport => ({ unresolved: new Set(), converted: 0 });

const span = (id: string, label = "label") =>
  `<span data-type="mention" data-id="${id}">${label}</span>`;

describe("rewriteContent", () => {
  it("rewrites attribute slug spans to attribute uuids", () => {
    const result = rewriteContent(
      `Hi ${span("/participant_imie", "Imie")},`,
      context(),
      report(),
    );
    expect(result).toBe(
      `Hi ${span(`/participant_${ATTRIBUTE_UUID}`, "Imie")},`,
    );
  });

  it("does not confuse a slug with a longer slug that starts with it", () => {
    const result = rewriteContent(
      span("/participant_imie-drugie"),
      context(),
      report(),
    );
    expect(result).toBe(span(`/participant_${LONG_ATTRIBUTE_UUID}`));
  });

  it("rewrites form slug spans to form uuids", () => {
    const result = rewriteContent(span("/form_form-slug"), context(), report());
    expect(result).toBe(span(`/form_${FORM_UUID}`));
  });

  it("maps the participant slug tag to the participant id tag", () => {
    const result = rewriteContent(
      span("/participant_slug"),
      context(),
      report(),
    );
    expect(result).toBe(span("/participant_id"));
  });

  it("leaves tags that exist in both versions unchanged", () => {
    const content = `${span("/event_name")}${span("/participant_email")}`;
    expect(rewriteContent(content, context(), report())).toBe(content);
  });

  it("keeps an unknown attribute tag and reports it", () => {
    const tags = report();
    const content = span("/participant_missing");
    expect(rewriteContent(content, context(), tags)).toBe(content);
    expect([...tags.unresolved]).toEqual(["/participant_missing"]);
  });

  it("rewrites repeated tags", () => {
    const content = `${span("/participant_imie")} ${span("/participant_imie")}`;
    const result = rewriteContent(content, context(), report());
    expect(result.split(ATTRIBUTE_UUID)).toHaveLength(3);
  });

  it("converts plain-text attribute tags outside of spans", () => {
    const tags = report();
    const result = rewriteContent("Hi /participant_imie!", context(), tags);
    expect(result).toBe(
      `Hi <span data-id="/participant_${ATTRIBUTE_UUID}">/participant_imie</span>!`,
    );
    expect(tags.converted).toBe(1);
  });

  it("prefers the longest plain-text slug", () => {
    const result = rewriteContent(
      "/participant_imie-drugie",
      context(),
      report(),
    );
    expect(result).toContain(`/participant_${LONG_ATTRIBUTE_UUID}`);
    expect(result).not.toContain(ATTRIBUTE_UUID);
  });

  it("does not touch plain-text tags inside an html attribute", () => {
    const tags = report();
    const content = '<a href="https://x.pl/participant_imie">link</a>';
    expect(rewriteContent(content, context(), tags)).toBe(content);
    expect(tags.unresolved.size).toBe(1);
    expect(tags.converted).toBe(0);
  });

  it("does not wrap tag text that is already inside a span", () => {
    const content = span("/participant_imie", "/participant_imie");
    const result = rewriteContent(content, context(), report());
    expect(result.match(/<span/g)).toHaveLength(1);
  });

  it("ignores plain-text fixed tags in non-legacy templates", () => {
    const content = "Welcome to /event_name";
    expect(rewriteContent(content, context(), report())).toBe(content);
  });
});

describe("rewriteContent for legacy templates", () => {
  it("wraps plain-text fixed tags in spans", () => {
    const tags = report();
    const result = rewriteContent(
      "Welcome to /event_name",
      context({ legacy: true }),
      tags,
    );
    expect(result).toBe(
      'Welcome to <span data-id="/event_name">/event_name</span>',
    );
    expect(tags.converted).toBe(1);
  });

  it("converts the participant slug tag", () => {
    const result = rewriteContent(
      "/participant_slug",
      context({ legacy: true }),
      report(),
    );
    expect(result).toBe(
      '<span data-id="/participant_id">/participant_slug</span>',
    );
  });

  it("converts the form url tag using the template form", () => {
    const result = rewriteContent(
      "Fill: /form_url",
      context({ legacy: true, legacyFormUuid: FORM_UUID }),
      report(),
    );
    expect(result).toBe(
      `Fill: <span data-id="/form_${FORM_UUID}">/form_url</span>`,
    );
  });

  it("reports the form url tag when the template has no form", () => {
    const tags = report();
    const content = "Fill: /form_url";
    expect(rewriteContent(content, context({ legacy: true }), tags)).toBe(
      content,
    );
    expect([...tags.unresolved]).toEqual(["/form_url"]);
  });

  it("reports the form url tag inside an href", () => {
    const tags = report();
    const content = '<a href="/form_url">Fill</a>';
    expect(
      rewriteContent(
        content,
        context({ legacy: true, legacyFormUuid: FORM_UUID }),
        tags,
      ),
    ).toBe(content);
    expect([...tags.unresolved]).toEqual([
      "/form_url (inside an HTML attribute)",
    ]);
  });
});

describe("rewriteSchema", () => {
  it("rewrites tags in nested string values only", () => {
    const schema = {
      content: [
        { props: { text: `<p>${span("/participant_imie")}</p>`, size: 3 } },
        { props: { text: "/participant_imie plain" } },
      ],
      root: { props: { title: "/participant_imie" } },
    };
    const result = rewriteSchema(schema, context(), report());
    expect(result).toEqual({
      content: [
        {
          props: {
            text: `<p>${span(`/participant_${ATTRIBUTE_UUID}`)}</p>`,
            size: 3,
          },
        },
        { props: { text: "/participant_imie plain" } },
      ],
      root: { props: { title: "/participant_imie" } },
    });
  });

  it("passes through values that are not objects, arrays or strings", () => {
    expect(rewriteSchema(null, context(), report())).toBeNull();
    expect(rewriteSchema(5, context(), report())).toBe(5);
  });
});
