import {
  HttpException,
  HttpStatus,
  Injectable,
  Logger,
  ServiceUnavailableException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";

import type { MobileGifDto, MobileGifSearchDto } from "./social.types";

const PAGE_SIZE = 24;
const CACHE_TTL_MS = 10 * 60_000;
const CACHE_MAX_ENTRIES = 500;
/** Per participant; the API key has an hourly limit shared by everyone */
const SEARCH_WINDOW_MS = 60_000;
const SEARCH_MAX_PER_WINDOW = 30;
const REQUEST_TIMEOUT_MS = 5000;

/** Only GIFs served by GIPHY can be sent, never arbitrary image links */
const GIF_HOST = /^(?:media\d*|i)\.giphy\.com$/;

interface GiphyRendition {
  url?: string;
  webp?: string;
  width?: string;
  height?: string;
}

interface GiphyResponse {
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
  private readonly cache = new Map<
    string,
    { at: number; value: MobileGifSearchDto }
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
    const normalized = query.trim().toLowerCase().slice(0, 50);
    const cacheKey = `${normalized}|${String(offset)}`;
    const cached = this.cache.get(cacheKey);
    if (cached !== undefined && Date.now() - cached.at < CACHE_TTL_MS) {
      return cached.value;
    }
    this.assertNotFlooding(participantUuid);

    const parameters = new URLSearchParams({
      api_key: this.apiKey,
      limit: String(PAGE_SIZE),
      offset: String(offset),
      rating: "pg-13",
      bundle: "messaging_non_clips",
    });
    if (normalized !== "") {
      parameters.set("q", normalized);
      parameters.set("lang", "pl");
    }
    const path = normalized === "" ? "gifs/trending" : "gifs/search";

    let body: GiphyResponse;
    try {
      const response = await fetch(
        `${this.baseUrl}/${path}?${parameters.toString()}`,
        { signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS) },
      );
      if (!response.ok) {
        throw new Error(`GIPHY responded ${String(response.status)}`);
      }
      body = (await response.json()) as GiphyResponse;
    } catch (error) {
      this.logger.warn(`GIF search failed: ${String(error)}`);
      throw new ServiceUnavailableException("GIF search is unavailable");
    }

    const results: MobileGifDto[] = [];
    for (const item of body.data ?? []) {
      const gif = this.toGif(item);
      if (gif !== null) {
        results.push(gif);
      }
    }
    const total = body.pagination?.total_count ?? 0;
    const next = offset + (body.pagination?.count ?? results.length);
    const value: MobileGifSearchDto = {
      enabled: true,
      results,
      nextOffset: results.length > 0 && next < total ? next : null,
    };

    if (this.cache.size >= CACHE_MAX_ENTRIES) {
      this.cache.clear();
    }
    this.cache.set(cacheKey, { at: Date.now(), value });
    return value;
  }

  private toGif(
    item: NonNullable<GiphyResponse["data"]>[number],
  ): MobileGifDto | null {
    const full = item.images?.fixed_width;
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
