export interface TagContext {
  attributes: ReadonlyMap<string, string>;
  forms: ReadonlyMap<string, string>;
  legacyFormUuid: string | null;
  legacy: boolean;
}

export interface TagReport {
  unresolved: Set<string>;
  converted: number;
}

export const LEGACY_TAG_CUTOFF = new Date("2025-11-09T22:23:00Z");

const SEGMENT = /<span[^>]*data-id="[^"]*"[^>]*>.*?<\/span>|<[^>]*>|[^<]+/gs;
const DATA_ID = /(data-id=")([^"]*)(")/;
const TOKEN_END = String.raw`(?![A-Za-z0-9_])`;

const EVENT_TAGS = [
  "/event_name",
  "/event_start_date",
  "/event_end_date",
  "/event_slug",
  "/event_primary_color",
  "/event_location",
];
const PARTICIPANT_TAGS = [
  "/participant_id",
  "/participant_email",
  "/participant_created_at",
  "/participant_updated_at",
];
const UNCHANGED_TAGS = new Set([
  ...EVENT_TAGS,
  ...PARTICIPANT_TAGS,
  "/ticket_link",
]);

function escapeRegExp(value: string) {
  return value.replaceAll(/[.*+?^${}()|[\]\\]/g, String.raw`\$&`);
}

function resolveTagId(id: string, context: TagContext, report: TagReport) {
  if (UNCHANGED_TAGS.has(id)) {
    return id;
  }
  if (id === "/participant_slug") {
    return "/participant_id";
  }
  if (id === "/form_url") {
    if (context.legacyFormUuid === null) {
      report.unresolved.add(id);
      return id;
    }
    return `/form_${context.legacyFormUuid}`;
  }
  if (id.startsWith("/participant_")) {
    const uuid = context.attributes.get(id.slice("/participant_".length));
    if (uuid === undefined) {
      report.unresolved.add(id);
      return id;
    }
    return `/participant_${uuid}`;
  }
  if (id.startsWith("/form_")) {
    const uuid = context.forms.get(id.slice("/form_".length));
    if (uuid === undefined) {
      report.unresolved.add(id);
      return id;
    }
    return `/form_${uuid}`;
  }
  return id;
}

function buildPlainTagPattern(context: TagContext) {
  const tokens = new Set([
    ...[...context.attributes.keys()].map((slug) => `/participant_${slug}`),
    ...[...context.forms.keys()].map((slug) => `/form_${slug}`),
  ]);
  if (context.legacy) {
    for (const tag of [
      ...EVENT_TAGS,
      ...PARTICIPANT_TAGS,
      "/participant_slug",
    ]) {
      tokens.add(tag);
    }
    if (context.legacyFormUuid !== null) {
      tokens.add("/form_url");
    }
  }
  if (tokens.size === 0) {
    return null;
  }
  const alternatives = [...tokens]
    .toSorted((a, b) => b.length - a.length)
    .map((token) => escapeRegExp(token))
    .join("|");
  return new RegExp(`(?:${alternatives})${TOKEN_END}`, "g");
}

function rewriteHtml(
  html: string,
  context: TagContext,
  report: TagReport,
  convertPlainText: boolean,
) {
  const plainPattern = convertPlainText ? buildPlainTagPattern(context) : null;

  const result = html.replaceAll(SEGMENT, (segment) => {
    if (segment.startsWith("<span") && DATA_ID.test(segment)) {
      return segment.replace(
        DATA_ID,
        (_match, open: string, id: string, close: string) =>
          `${open}${resolveTagId(id, context, report)}${close}`,
      );
    }
    if (plainPattern === null) {
      return segment;
    }
    if (segment.startsWith("<")) {
      for (const [token] of segment.matchAll(plainPattern)) {
        report.unresolved.add(`${token} (inside an HTML attribute)`);
      }
      return segment;
    }
    return segment.replaceAll(plainPattern, (token) => {
      report.converted += 1;
      return `<span data-id="${resolveTagId(token, context, report)}">${token}</span>`;
    });
  });

  if (
    convertPlainText &&
    context.legacy &&
    context.legacyFormUuid === null &&
    /\/form_url\b/.test(html)
  ) {
    report.unresolved.add("/form_url");
  }
  return result;
}

export function rewriteContent(
  content: string,
  context: TagContext,
  report: TagReport,
) {
  return rewriteHtml(content, context, report, true);
}

export function rewriteSchema(
  value: unknown,
  context: TagContext,
  report: TagReport,
): unknown {
  if (typeof value === "string") {
    return value.includes("data-id=")
      ? rewriteHtml(value, context, report, false)
      : value;
  }
  if (Array.isArray(value)) {
    return value.map((item) => rewriteSchema(item, context, report));
  }
  if (typeof value === "object" && value !== null) {
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [
        key,
        rewriteSchema(item, context, report),
      ]),
    );
  }
  return value;
}
