import {
  BadRequestException,
  CanActivate,
  ExecutionContext,
  Injectable,
  Logger,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";

export const TURNSTILE_RESPONSE_FIELD = "cf-turnstile-response";

const SITEVERIFY_URL =
  "https://challenges.cloudflare.com/turnstile/v0/siteverify";
const SITEVERIFY_TIMEOUT_MS = 10_000;

interface SiteverifyResponse {
  success: boolean;
  "error-codes": string[];
}

/**
 * Verifies the Cloudflare Turnstile token sent in the `cf-turnstile-response` body field.
 * @see https://developers.cloudflare.com/turnstile/get-started/server-side-validation/
 */
@Injectable()
export class TurnstileGuard implements CanActivate {
  private readonly logger = new Logger(TurnstileGuard.name);

  constructor(private readonly configService: ConfigService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<{
      body?: Record<string, unknown>;
    }>();
    const token = request.body?.[TURNSTILE_RESPONSE_FIELD];

    if (typeof token !== "string" || token === "") {
      throw new BadRequestException(`Missing ${TURNSTILE_RESPONSE_FIELD}`);
    }

    const response = await fetch(SITEVERIFY_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        secret: this.configService.getOrThrow<string>("TURNSTILE_SECRET"),
        response: token,
      }),
      signal: AbortSignal.timeout(SITEVERIFY_TIMEOUT_MS),
    });
    const result = (await response.json()) as SiteverifyResponse;

    if (!result.success) {
      this.logger.warn(
        `Turnstile verification failed: ${result["error-codes"].join(", ")}`,
      );
      throw new BadRequestException(`Invalid ${TURNSTILE_RESPONSE_FIELD}`);
    }

    return true;
  }
}
