import {
  HttpException,
  HttpStatus,
  Injectable,
  Logger,
  ServiceUnavailableException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";

import type { MobileGifDto, MobileGifSearchDto } from "./social.types";

const PAGE_SIZE = 30;
/**
 * A starting ("beta") GIPHY key allows about 100 requests an hour for the
 * whole server, so results are kept long: trending changes slowly and search
 * results for a phrase barely at all.
 */
const TRENDING_TTL_MS = 30 * 60_000;
const SEARCH_TTL_MS = 6 * 60 * 60_000;
/** A genuine "nothing found" is remembered only briefly */
const EMPTY_TTL_MS = 10 * 60_000;
const CACHE_MAX_ENTRIES = 2000;
/** Per participant; the API key has an hourly limit shared by everyone */
const SEARCH_WINDOW_MS = 60_000;
const SEARCH_MAX_PER_WINDOW = 30;
const REQUEST_TIMEOUT_MS = 5000;

class GiphyLimitError extends Error {
  constructor() {
    super("GIPHY rate limit reached");
  }
}

/** Only GIFs served by GIPHY can be sent, never arbitrary image links */
const GIF_HOST = /^(?:media\d*|i)\.giphy\.com$/;

interface GiphyRendition {
  url?: string;
  webp?: string;
  width?: string;
  height?: string;
}

interface GiphyResponse {
  meta?: { status?: number; msg?: string };
  data?: {
    id?: string;
    title?: string;
    images?: Record<string, GiphyRendition | undefined>;
  }[];
  pagination?: { total_count?: number; count?: number; offset?: number };
}

/**
 * GIF search through the GIPHY API. Inert (search reports `enabled: false`)
 * unless GIPHY_API_KEY is set. The key never leaves the server.
 */
@Injectable()
export class MobileGifService {
  private readonly logger = new Logger(MobileGifService.name);
  private readonly apiKey: string | null;
  private readonly baseUrl: string;
  /** Insertion ordered: the first entry is the oldest */
  private readonly cache = new Map<
    string,
    { expiresAt: number; value: MobileGifSearchDto }
  >();
  private readonly recentSearches = new Map<string, number[]>();

  constructor(configService: ConfigService) {
    const key = configService.get<string>("GIPHY_API_KEY")?.trim();
    this.apiKey = key === undefined || key === "" ? null : key;
    // Overridable for local testing against a stub
    const baseUrl = configService.get<string>("GIPHY_API_URL")?.trim();
    this.baseUrl =
      baseUrl === undefined || baseUrl === ""
        ? "https://api.giphy.com/v1"
        : baseUrl;
  }

  get enabled(): boolean {
    return this.apiKey !== null;
  }

  /** True for a GIPHY media URL; used to validate GIFs sent to the chat */
  isAllowedUrl(value: string): boolean {
    try {
      const url = new URL(value);
      return url.protocol === "https:" && GIF_HOST.test(url.hostname);
    } catch {
      return false;
    }
  }

  async search(
    participantUuid: string,
    query: string,
    offset: number,
  ): Promise<MobileGifSearchDto> {
    if (this.apiKey === null) {
      return { enabled: false, results: [], nextOffset: null };
    }
    const normalized = query
      .trim()
      .toLowerCase()
      .replaceAll(/\s+/g, " ")
      .slice(0, 50);
    const cacheKey = `${normalized}|${String(offset)}`;
    const cached = this.cache.get(cacheKey);
    if (cached !== undefined && Date.now() < cached.expiresAt) {
      return cached.value;
    }
    this.assertNotFlooding(participantUuid);

    try {
      let page = await this.fetchPage(normalized, offset, "pl");
      // Polish phrases GIPHY does not know often have English matches
      if (normalized !== "" && offset === 0 && page.results.length === 0) {
        page = await this.fetchPage(normalized, offset, null);
      }
      const ttl =
        page.results.length === 0
          ? EMPTY_TTL_MS
          : normalized === ""
            ? TRENDING_TTL_MS
            : SEARCH_TTL_MS;
      this.remember(cacheKey, page, ttl);
      return page;
    } catch (error) {
      this.logger.warn(
        `GIF search for "${normalized}" failed: ${String(error)}`,
      );
      // Better an older answer than none while GIPHY refuses (rate limit)
      if (cached !== undefined) {
        return cached.value;
      }
      throw new ServiceUnavailableException(
        error instanceof GiphyLimitError
          ? "GIF limit reached, try again later"
          : "GIF search is unavailable",
      );
    }
  }

  /** One page from GIPHY; throws when GIPHY did not answer properly */
  private async fetchPage(
    query: string,
    offset: number,
    lang: string | null,
  ): Promise<MobileGifSearchDto> {
    if (this.apiKey === null) {
      throw new Error("GIPHY is not configured");
    }
    const parameters = new URLSearchParams({
      api_key: this.apiKey,
      limit: String(PAGE_SIZE),
      offset: String(offset),
      // GIPHY's least strict rating: no extra filtering on top of GIPHY's own
      rating: "r",
      bundle: "messaging_non_clips",
    });
    if (query !== "") {
      parameters.set("q", query);
      if (lang !== null) {
        parameters.set("lang", lang);
      }
    }
    const path = query === "" ? "gifs/trending" : "gifs/search";

    const response = await fetch(
      `${this.baseUrl}/${path}?${parameters.toString()}`,
      { signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS) },
    );
    const body = (await response
      .json()
      .catch(() => null)) as GiphyResponse | null;
    // GIPHY reports some failures only inside the body
    const status = body?.meta?.status ?? response.status;
    if (status === 429) {
      throw new GiphyLimitError();
    }
    if (!response.ok || status !== 200 || body === null) {
      throw new Error(
        `GIPHY responded ${String(response.status)}/${String(status)} ${body?.meta?.msg ?? ""}`,
      );
    }

    const items = body.data ?? [];
    const results: MobileGifDto[] = [];
    for (const item of items) {
      const gif = this.toGif(item);
      if (gif !== null) {
        results.push(gif);
      }
    }
    if (items.length > 0 && results.length === 0) {
      // A change in GIPHY's response format; worth seeing in the logs
      this.logger.warn(
        `GIPHY returned ${String(items.length)} GIFs but none could be used; renditions: ${Object.keys(items[0].images ?? {}).join(",")}`,
      );
    }
    const total = body.pagination?.total_count ?? 0;
    const next = offset + (body.pagination?.count ?? items.length);
    return {
      enabled: true,
      results,
      nextOffset: items.length > 0 && next < total ? next : null,
    };
  }

  private remember(key: string, value: MobileGifSearchDto, ttl: number): void {
    this.cache.delete(key);
    if (this.cache.size >= CACHE_MAX_ENTRIES) {
      // Drop the oldest tenth in one go
      const oldest = [...this.cache.keys()].slice(
        0,
        Math.ceil(CACHE_MAX_ENTRIES / 10),
      );
      for (const entry of oldest) {
        this.cache.delete(entry);
      }
    }
    this.cache.set(key, { expiresAt: Date.now() + ttl, value });
  }

  private toGif(
    item: NonNullable<GiphyResponse["data"]>[number],
  ): MobileGifDto | null {
    const full =
      item.images?.fixed_width ??
      item.images?.fixed_width_downsampled ??
      item.images?.downsized ??
      item.images?.original;
    const small = item.images?.fixed_width_small ?? full;
    const url = full?.webp ?? full?.url;
    const width = Number(full?.width);
    const height = Number(full?.height);
    if (
      item.id === undefined ||
      url === undefined ||
      !this.isAllowedUrl(url) ||
      !(width > 0) ||
      !(height > 0)
    ) {
      return null;
    }
    const preview = small?.webp ?? small?.url ?? url;
    return {
      id: item.id,
      title: item.title ?? "",
      url,
      previewUrl: this.isAllowedUrl(preview) ? preview : url,
      width,
      height,
    };
  }

  private assertNotFlooding(participantUuid: string): void {
    const now = Date.now();
    const recent = (this.recentSearches.get(participantUuid) ?? []).filter(
      (timestamp) => now - timestamp < SEARCH_WINDOW_MS,
    );
    if (recent.length >= SEARCH_MAX_PER_WINDOW) {
      this.recentSearches.set(participantUuid, recent);
      throw new HttpException(
        "Too many GIF searches, slow down",
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
    recent.push(now);
    if (this.recentSearches.size > 50_000) {
      this.recentSearches.clear();
    }
    this.recentSearches.set(participantUuid, recent);
  }
}
