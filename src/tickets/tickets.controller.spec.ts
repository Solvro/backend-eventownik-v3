import { PermissionsGuard } from "src/auth/permissions.guard";
import { PermissionType } from "src/generated/prisma/enums";

import type { ExecutionContext } from "@nestjs/common";
import { Reflector } from "@nestjs/core";

import { TicketsController } from "./tickets.controller";

type HandlerName = "create" | "findAll" | "findOne" | "update" | "remove";

const eventId = "3fa85f64-5717-4562-b3fc-2c963f66afa6";
const guard = new PermissionsGuard(new Reflector());

function canCall(handlerName: HandlerName, permission: PermissionType) {
  const handler = Object.getOwnPropertyDescriptor(
    TicketsController.prototype,
    handlerName,
  )?.value as (...arguments_: never[]) => unknown;

  const context = {
    getHandler: () => handler,
    getClass: () => TicketsController,
    switchToHttp: () => ({
      getRequest: () => ({
        params: { eventId },
        user: {
          type: "organizer",
          permissions: [{ eventId, permission }],
        },
      }),
    }),
  } as unknown as ExecutionContext;

  return guard.canActivate(context);
}

describe("TicketsController permissions", () => {
  it.each<HandlerName>(["create", "update", "remove"])(
    "%s requires MANAGE_TICKET",
    (handlerName) => {
      expect(canCall(handlerName, PermissionType.MANAGE_TICKET)).toBe(true);
      expect(canCall(handlerName, PermissionType.SCAN_TICKET)).toBe(false);
      expect(canCall(handlerName, PermissionType.MANAGE_PARTICIPANT)).toBe(
        false,
      );
    },
  );

  it.each<HandlerName>(["findAll", "findOne"])(
    "%s allows MANAGE_TICKET and SCAN_TICKET",
    (handlerName) => {
      expect(canCall(handlerName, PermissionType.MANAGE_TICKET)).toBe(true);
      expect(canCall(handlerName, PermissionType.SCAN_TICKET)).toBe(true);
      expect(canCall(handlerName, PermissionType.MANAGE_PARTICIPANT)).toBe(
        false,
      );
    },
  );

  it.each<HandlerName>(["create", "findAll", "findOne", "update", "remove"])(
    "%s allows MANAGE_ALL",
    (handlerName) => {
      expect(canCall(handlerName, PermissionType.MANAGE_ALL)).toBe(true);
    },
  );
});
