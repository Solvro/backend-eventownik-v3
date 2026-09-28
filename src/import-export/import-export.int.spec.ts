import * as ExcelJS from "exceljs";
import type { Request, Response } from "express";
import { JwtAuthGuard } from "src/auth/jwt-auth.guard";
import { PermissionsGuard } from "src/auth/permissions.guard";
import type { Attribute, Block, Event } from "src/generated/prisma/client";
import { AttributeType } from "src/generated/prisma/enums";
import { ParticipantsService } from "src/participants/participants.service";
import { PrismaService } from "src/prisma/prisma.service";
import { StorageService } from "src/storage/storage.service";

import { BadRequestException, NotFoundException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { EventEmitter2 } from "@nestjs/event-emitter";
import type { TestingModule } from "@nestjs/testing";
import { Test } from "@nestjs/testing";

import { ParticipantsXlsxExporter } from "./exporters/participants-xlsx.exporter";
import { ImportExportController } from "./import-export.controller";
import { ImportExportService } from "./import-export.service";

const uniq = () => Math.random().toString(36).slice(2);

async function buildXlsx(rows: unknown[][]): Promise<Express.Multer.File> {
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet("Participants");
  for (const row of rows) {
    worksheet.addRow(row);
  }
  const buffer = Buffer.from(await workbook.xlsx.writeBuffer());
  return { buffer } as unknown as Express.Multer.File;
}

describe("Import/Export Integration", () => {
  let controller: ImportExportController;
  let prisma: PrismaService;

  const createdEventUuids: string[] = [];
  const allowAll = { canActivate: () => true };

  const jsonRequest = {
    is: jest.fn().mockReturnValue(false),
  } as unknown as Request;
  const multipartRequest = {
    is: jest.fn().mockReturnValue("multipart/form-data"),
  } as unknown as Request;

  beforeAll(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ImportExportController],
      providers: [
        ImportExportService,
        ParticipantsXlsxExporter,
        ParticipantsService,
        PrismaService,
        {
          provide: StorageService,
          useValue: {
            getUrl: jest.fn(),
            extractKey: jest.fn((_bucket: string, value: string) => value),
          },
        },
        {
          provide: ConfigService,
          useValue: { getOrThrow: jest.fn().mockReturnValue("test-bucket") },
        },
        {
          provide: EventEmitter2,
          useValue: { emit: jest.fn() },
        },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue(allowAll)
      .overrideGuard(PermissionsGuard)
      .useValue(allowAll)
      .compile();

    controller = module.get<ImportExportController>(ImportExportController);
    prisma = module.get<PrismaService>(PrismaService);
  });

  afterAll(async () => {
    await prisma.event.deleteMany({
      where: { uuid: { in: createdEventUuids } },
    });
    await prisma.$disconnect();
  });

  async function createEvent(): Promise<Event> {
    const event = await prisma.event.create({
      data: {
        name: "Import Export Test Event",
        slug: `import-export-int-${String(Date.now())}-${uniq()}`,
        startDate: new Date("2025-06-01"),
        endDate: new Date("2025-06-02"),
      },
    });
    createdEventUuids.push(event.uuid);
    return event;
  }

  async function createAttribute(
    eventUuid: string,
    overrides: Partial<{
      type: AttributeType;
      name: string;
      order: number;
      config: object;
    }> = {},
  ): Promise<Attribute> {
    return prisma.attribute.create({
      data: {
        eventUuid,
        type: AttributeType.text,
        name: "Test Attribute",
        order: 1,
        config: {},
        ...overrides,
      },
    });
  }

  async function createBlock(
    attributeUuid: string,
    name: string,
  ): Promise<Block> {
    return prisma.block.create({ data: { name, attributeUuid } });
  }

  async function findParticipant(eventUuid: string, email: string) {
    return prisma.participant.findFirst({
      where: { eventUuid, email },
      include: { attributes: true },
    });
  }

  describe("JSON input", () => {
    it("imports new participants, skipping duplicates in the body and participants already in the event", async () => {
      const event = await createEvent();
      const company = await createAttribute(event.uuid, { name: "Company" });
      const existingEmail = `existing-${uniq()}@example.com`;
      const newEmail = `new-${uniq()}@example.com`;
      await prisma.participant.create({
        data: { email: existingEmail, eventUuid: event.uuid },
      });

      const result = await controller.importParticipants(
        event.uuid,
        jsonRequest,
        {
          participants: [
            {
              email: newEmail.toUpperCase(),
              participantAttributes: [
                { attributeUuid: company.uuid, value: "ACME" },
              ],
            },
            { email: newEmail },
            { email: existingEmail },
          ],
        },
      );

      expect(result.importedParticipants).toHaveLength(1);
      expect(result.importedParticipants[0].email).toBe(newEmail);
      expect(result.skippedParticipants).toEqual([
        {
          email: newEmail,
          reason: "duplicate_in_file",
          message: expect.any(String) as string,
        },
        {
          email: existingEmail,
          reason: "already_exists",
          message: expect.any(String) as string,
        },
      ]);

      const stored = await findParticipant(event.uuid, newEmail);
      expect(stored?.attributes).toHaveLength(1);
      expect(stored?.attributes[0].value).toBe("ACME");
    });

    it("keeps importing after a row fails attribute validation", async () => {
      const event = await createEvent();
      const size = await createAttribute(event.uuid, {
        type: AttributeType.select,
        name: "Size",
        config: { options: ["S", "M"] },
      });
      const emails = [
        `ok1-${uniq()}@example.com`,
        `bad-${uniq()}@example.com`,
        `ok2-${uniq()}@example.com`,
      ];

      const result = await controller.importParticipants(
        event.uuid,
        jsonRequest,
        {
          participants: [
            {
              email: emails[0],
              participantAttributes: [{ attributeUuid: size.uuid, value: "S" }],
            },
            {
              email: emails[1],
              participantAttributes: [
                { attributeUuid: size.uuid, value: "XL" },
              ],
            },
            {
              email: emails[2],
              participantAttributes: [{ attributeUuid: size.uuid, value: "M" }],
            },
          ],
        },
      );

      expect(result.importedParticipants.map((p) => p.email)).toEqual([
        emails[0],
        emails[2],
      ]);
      expect(result.skippedParticipants).toHaveLength(1);
      expect(result.skippedParticipants[0]).toMatchObject({
        email: emails[1],
        reason: "failed",
      });
      expect(await findParticipant(event.uuid, emails[1])).toBeNull();
      expect(
        await prisma.participant.count({
          where: { eventUuid: event.uuid },
        }),
      ).toBe(2);
    });

    it("accepts block UUIDs and rejects block names", async () => {
      const event = await createEvent();
      const group = await createAttribute(event.uuid, {
        type: AttributeType.block,
        name: "Group",
      });
      const block = await createBlock(group.uuid, "Workshop A");
      const okEmail = `uuid-${uniq()}@example.com`;
      const nameEmail = `name-${uniq()}@example.com`;

      const result = await controller.importParticipants(
        event.uuid,
        jsonRequest,
        {
          participants: [
            {
              email: okEmail,
              participantAttributes: [
                { attributeUuid: group.uuid, value: block.uuid },
              ],
            },
            {
              email: nameEmail,
              participantAttributes: [
                { attributeUuid: group.uuid, value: "Workshop A" },
              ],
            },
          ],
        },
      );

      expect(result.importedParticipants.map((p) => p.email)).toEqual([
        okEmail,
      ]);
      expect(result.skippedParticipants).toHaveLength(1);
      expect(result.skippedParticipants[0]).toMatchObject({
        email: nameEmail,
        reason: "failed",
      });

      const stored = await findParticipant(event.uuid, okEmail);
      expect(stored?.attributes[0].value).toEqual([block.uuid]);
    });

    it("rejects a body without participants", async () => {
      const event = await createEvent();

      await expect(
        controller.importParticipants(event.uuid, jsonRequest, {}),
      ).rejects.toThrow(BadRequestException);
    });

    it("rejects an empty participants array", async () => {
      const event = await createEvent();

      await expect(
        controller.importParticipants(event.uuid, jsonRequest, {
          participants: [],
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it("rejects more than 2000 participants", async () => {
      const event = await createEvent();
      const participants = Array.from({ length: 2001 }, (_, index) => ({
        email: `p${String(index)}@example.com`,
      }));

      await expect(
        controller.importParticipants(event.uuid, jsonRequest, {
          participants,
        }),
      ).rejects.toThrow(BadRequestException);

      expect(
        await prisma.participant.count({ where: { eventUuid: event.uuid } }),
      ).toBe(0);
    });

    it("rejects a body with an invalid email (validated by the DTO)", async () => {
      const event = await createEvent();

      await expect(
        controller.importParticipants(event.uuid, jsonRequest, {
          participants: [{ email: "not-an-email" }],
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it("returns 404 for an unknown event", async () => {
      await expect(
        controller.importParticipants(
          "00000000-0000-4000-8000-000000000000",
          jsonRequest,
          { participants: [{ email: "a@example.com" }] },
        ),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe("XLSX input", () => {
    it("imports participants and their attributes from a file", async () => {
      const event = await createEvent();
      await createAttribute(event.uuid, { name: "Company" });
      const email = `xlsx-${uniq()}@example.com`;
      const file = await buildXlsx([
        ["participantUuid", "email", "Company"],
        ["ignored-uuid", email.toUpperCase(), "ACME"],
      ]);

      const result = await controller.importParticipants(
        event.uuid,
        multipartRequest,
        undefined,
        file,
      );

      expect(result.skippedParticipants).toEqual([]);
      expect(result.importedParticipants).toHaveLength(1);

      const stored = await findParticipant(event.uuid, email);
      expect(stored).not.toBeNull();
      expect(stored?.attributes[0].value).toBe("ACME");
    });

    it("rejects the whole file on an unknown header and writes nothing", async () => {
      const event = await createEvent();
      const file = await buildXlsx([
        ["email", "Remarks"],
        [`a-${uniq()}@example.com`, "hi"],
      ]);

      await expect(
        controller.importParticipants(
          event.uuid,
          multipartRequest,
          undefined,
          file,
        ),
      ).rejects.toThrow('Unknown column header: "Remarks"');

      expect(
        await prisma.participant.count({ where: { eventUuid: event.uuid } }),
      ).toBe(0);
    });

    it("resolves block names to UUIDs and fails rows with unknown names", async () => {
      const event = await createEvent();
      const group = await createAttribute(event.uuid, {
        type: AttributeType.block,
        name: "Group",
      });
      const block = await createBlock(group.uuid, "Workshop A");
      const okEmail = `ok-${uniq()}@example.com`;
      const badEmail = `bad-${uniq()}@example.com`;
      const file = await buildXlsx([
        ["email", "Group"],
        [okEmail, "Workshop A"],
        [badEmail, "Missing block"],
      ]);

      const result = await controller.importParticipants(
        event.uuid,
        multipartRequest,
        undefined,
        file,
      );

      expect(result.importedParticipants.map((p) => p.email)).toEqual([
        okEmail,
      ]);
      expect(result.skippedParticipants).toHaveLength(1);
      expect(result.skippedParticipants[0]).toMatchObject({
        email: badEmail,
        reason: "failed",
      });
      expect(result.skippedParticipants[0].message).toContain("not found");

      const stored = await findParticipant(event.uuid, okEmail);
      expect(stored?.attributes[0].value).toEqual([block.uuid]);
    });

    it("fails rows with an ambiguous block name", async () => {
      const event = await createEvent();
      const group = await createAttribute(event.uuid, {
        type: AttributeType.block,
        name: "Group",
      });
      await createBlock(group.uuid, "Twin");
      await createBlock(group.uuid, "Twin");
      const email = `twin-${uniq()}@example.com`;
      const file = await buildXlsx([
        ["email", "Group"],
        [email, "Twin"],
      ]);

      const result = await controller.importParticipants(
        event.uuid,
        multipartRequest,
        undefined,
        file,
      );

      expect(result.importedParticipants).toEqual([]);
      expect(result.skippedParticipants[0].message).toContain("ambiguous");
    });

    it("rejects a multipart request without a file", async () => {
      const event = await createEvent();

      await expect(
        controller.importParticipants(event.uuid, multipartRequest, {}),
      ).rejects.toThrow("Missing file: participantsFile");
    });
  });

  describe("export -> import round trip", () => {
    it("re-imports an exported file, including attributes that share a name", async () => {
      const event = await createEvent();
      const first = await createAttribute(event.uuid, {
        name: "Note",
        order: 1,
      });
      const second = await createAttribute(event.uuid, {
        name: "Note",
        order: 2,
      });
      const email = `round-${uniq()}@example.com`;

      await controller.importParticipants(event.uuid, jsonRequest, {
        participants: [
          {
            email,
            participantAttributes: [
              { attributeUuid: first.uuid, value: "one" },
              { attributeUuid: second.uuid, value: "two" },
            ],
          },
        ],
      });

      const send = jest.fn();
      const response = { setHeader: jest.fn(), send } as unknown as Response;
      await controller.exportParticipants(event.uuid, {}, response);
      const exported = (send.mock.calls[0] as [Buffer])[0];

      await prisma.participant.deleteMany({
        where: { eventUuid: event.uuid },
      });

      const result = await controller.importParticipants(
        event.uuid,
        multipartRequest,
        undefined,
        { buffer: exported } as unknown as Express.Multer.File,
      );

      expect(result.skippedParticipants).toEqual([]);
      expect(result.importedParticipants).toHaveLength(1);

      const stored = await findParticipant(event.uuid, email);
      const valueOf = (attributeUuid: string) =>
        stored?.attributes.find((a) => a.attributeUuid === attributeUuid)
          ?.value;
      expect(valueOf(first.uuid)).toBe("one");
      expect(valueOf(second.uuid)).toBe("two");
    });
  });
});
