import { PermissionsGuard } from "src/auth/permissions.guard";
import { PermissionType } from "src/generated/prisma/enums";

import type { ExecutionContext } from "@nestjs/common";
import { Reflector } from "@nestjs/core";

import { TicketScanController } from "./ticket-scan.controller";
import { TicketsController } from "./tickets.controller";

type HandlerName =
  "create" | "findAll" | "findOne" | "findParticipants" | "update" | "remove";

const eventId = "3fa85f64-5717-4562-b3fc-2c963f66afa6";
const guard = new PermissionsGuard(new Reflector());

function canCallOn(
  controller: new (...arguments_: never[]) => unknown,
  handlerName: string,
  permission: PermissionType,
) {
  const handler = Object.getOwnPropertyDescriptor(
    controller.prototype,
    handlerName,
  )?.value as (...arguments_: never[]) => unknown;

  const context = {
    getHandler: () => handler,
    getClass: () => controller,
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

function canCall(handlerName: HandlerName, permission: PermissionType) {
  return canCallOn(TicketsController, handlerName, permission);
}

function canScan(handlerName: "scan" | "confirm", permission: PermissionType) {
  return canCallOn(TicketScanController, handlerName, permission);
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

  it.each<HandlerName>(["findAll", "findOne", "findParticipants"])(
    "%s allows MANAGE_TICKET and SCAN_TICKET",
    (handlerName) => {
      expect(canCall(handlerName, PermissionType.MANAGE_TICKET)).toBe(true);
      expect(canCall(handlerName, PermissionType.SCAN_TICKET)).toBe(true);
      expect(canCall(handlerName, PermissionType.MANAGE_PARTICIPANT)).toBe(
        false,
      );
    },
  );

  it.each<HandlerName>([
    "create",
    "findAll",
    "findOne",
    "findParticipants",
    "update",
    "remove",
  ])("%s allows MANAGE_ALL", (handlerName) => {
    expect(canCall(handlerName, PermissionType.MANAGE_ALL)).toBe(true);
  });
});

describe("TicketScanController permissions", () => {
  it.each<"scan" | "confirm">(["scan", "confirm"])(
    "%s requires SCAN_TICKET",
    (handlerName) => {
      expect(canScan(handlerName, PermissionType.SCAN_TICKET)).toBe(true);
      expect(canScan(handlerName, PermissionType.MANAGE_ALL)).toBe(true);
      expect(canScan(handlerName, PermissionType.MANAGE_TICKET)).toBe(false);
      expect(canScan(handlerName, PermissionType.MANAGE_PARTICIPANT)).toBe(
        false,
      );
    },
  );
});
