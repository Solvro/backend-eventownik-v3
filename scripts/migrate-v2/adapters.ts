import {
  DeleteObjectCommand,
  HeadObjectCommand,
  NotFound,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { readFile } from "node:fs/promises";
import path from "node:path";
import type { Prisma, PrismaClient } from "src/generated/prisma/client";

import type { S3Config } from "./config";
import type { PlannedRow } from "./types";

export type WriteMode = "insert" | "update";

export interface EntityAdapter {
  read: (
    targetId: string,
    keys: string[],
  ) => Promise<Record<string, unknown> | null>;
  write: (
    client: Prisma.TransactionClient,
    row: PlannedRow,
    mode: WriteMode,
  ) => Promise<void>;
  remove: (client: Prisma.TransactionClient, targetId: string) => Promise<void>;
}

interface Delegate {
  findUnique: (arguments_: unknown) => Promise<Record<string, unknown> | null>;
  create: (arguments_: unknown) => Promise<unknown>;
  update: (arguments_: unknown) => Promise<unknown>;
  deleteMany: (arguments_: unknown) => Promise<unknown>;
}

const delegateOf = (
  client: PrismaClient | Prisma.TransactionClient,
  model: string,
) =>
  (client as unknown as Record<string, Delegate>)[
    model.charAt(0).toLowerCase() + model.slice(1)
  ];

export function createModelAdapter(
  prisma: PrismaClient,
  model: string,
  patchesExisting = false,
): EntityAdapter {
  return {
    read: async (uuid, keys) =>
      delegateOf(prisma, model).findUnique({
        where: { uuid },
        select: Object.fromEntries(keys.map((key) => [key, true])),
      }),
    write: async (client, row, mode) => {
      const delegate = delegateOf(client, model);
      if (mode === "insert" && !patchesExisting) {
        await delegate.create({
          data: { uuid: row.targetId, ...row.payload, ...row.insertOnly },
        });
        return;
      }
      await delegate.update({
        where: { uuid: row.targetId },
        data:
          mode === "insert"
            ? { ...row.payload, ...row.insertOnly }
            : row.payload,
      });
    },
    remove: async (client, uuid) => {
      await delegateOf(client, model).deleteMany({ where: { uuid } });
    },
  };
}

const CONTENT_TYPES = new Map([
  [".jpg", "image/jpeg"],
  [".jpeg", "image/jpeg"],
  [".png", "image/png"],
  [".webp", "image/webp"],
  [".gif", "image/gif"],
  [".svg", "image/svg+xml"],
  [".pdf", "application/pdf"],
  [".doc", "application/msword"],
  [
    ".docx",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ],
]);

export function createBlobAdapter(config: S3Config): EntityAdapter {
  const client = new S3Client({
    endpoint: config.endpoint,
    region: "auto",
    forcePathStyle: true,
    credentials: {
      accessKeyId: config.accessKey,
      secretAccessKey: config.secretKey,
    },
  });
  const locate = (targetId: string) => {
    const separator = targetId.indexOf("/");
    const bucket = targetId.slice(0, separator) as "events" | "forms";
    return {
      bucket: config.buckets[bucket],
      key: targetId.slice(separator + 1),
    };
  };

  return {
    read: async (targetId) => {
      const { bucket, key } = locate(targetId);
      try {
        const head = await client.send(
          new HeadObjectCommand({ Bucket: bucket, Key: key }),
        );
        return { size: head.ContentLength };
      } catch (error) {
        if (error instanceof NotFound) {
          return null;
        }
        throw error;
      }
    },
    write: async (_client, row) => {
      if (row.blob === undefined) {
        throw new Error("blob row without a source file");
      }
      const { bucket, key } = locate(row.targetId);
      await client.send(
        new PutObjectCommand({
          Bucket: bucket,
          Key: key,
          Body: await readFile(row.blob.path),
          ContentType:
            CONTENT_TYPES.get(path.extname(key).toLowerCase()) ??
            "application/octet-stream",
        }),
      );
    },
    remove: async (_client, targetId) => {
      const { bucket, key } = locate(targetId);
      await client.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }));
    },
  };
}
