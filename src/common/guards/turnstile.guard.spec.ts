import { BadRequestException } from "@nestjs/common";
import type { ExecutionContext } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Test } from "@nestjs/testing";
import type { TestingModule } from "@nestjs/testing";

import { TURNSTILE_RESPONSE_FIELD, TurnstileGuard } from "./turnstile.guard";

const TEST_SECRET = "1x0000000000000000000000000000000AA";

function createContext(body?: Record<string, unknown>): ExecutionContext {
  return {
    switchToHttp: () => ({
      getRequest: () => ({ body }),
    }),
  } as unknown as ExecutionContext;
}

function mockSiteverifyResponse(result: {
  success: boolean;
  "error-codes": string[];
}) {
  return jest
    .spyOn(globalThis, "fetch")
    .mockResolvedValue(Response.json(result));
}

describe("TurnstileGuard", () => {
  let guard: TurnstileGuard;

  const mockConfigService = {
    getOrThrow: jest.fn((key: string) => {
      if (key === "TURNSTILE_SECRET") {
        return TEST_SECRET;
      }
      throw new Error(`Unexpected config key requested in test: ${key}`);
    }),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TurnstileGuard,
        { provide: ConfigService, useValue: mockConfigService },
      ],
    }).compile();

    guard = module.get<TurnstileGuard>(TurnstileGuard);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("rejects requests without a token and skips verification", async () => {
    const fetchSpy = jest.spyOn(globalThis, "fetch");

    await expect(guard.canActivate(createContext({}))).rejects.toThrow(
      BadRequestException,
    );
    await expect(guard.canActivate(createContext())).rejects.toThrow(
      BadRequestException,
    );
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("allows requests with a valid token", async () => {
    const fetchSpy = mockSiteverifyResponse({
      success: true,
      "error-codes": [],
    });

    await expect(
      guard.canActivate(
        createContext({ [TURNSTILE_RESPONSE_FIELD]: "valid-token" }),
      ),
    ).resolves.toBe(true);

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const [url, init] = fetchSpy.mock.calls[0];
    expect(url).toBe(
      "https://challenges.cloudflare.com/turnstile/v0/siteverify",
    );
    expect(JSON.parse(init?.body as string)).toEqual({
      secret: TEST_SECRET,
      response: "valid-token",
    });
  });

  it("rejects requests with an invalid token", async () => {
    mockSiteverifyResponse({
      success: false,
      "error-codes": ["timeout-or-duplicate"],
    });

    await expect(
      guard.canActivate(
        createContext({ [TURNSTILE_RESPONSE_FIELD]: "used-token" }),
      ),
    ).rejects.toThrow(BadRequestException);
  });
});
