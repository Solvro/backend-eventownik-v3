import {
  AuditAction,
  AuditEntityType,
} from "src/audit-log/audit-log.constants";
import { AuditLogService } from "src/audit-log/audit-log.service";
import type { AuditActor } from "src/audit-log/audit-log.types";
import { Prisma } from "src/generated/prisma/client";
import { ParticipantsService } from "src/participants/participants.service";
import { PrismaService } from "src/prisma/prisma.service";

import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";

import { CreateBlockDto } from "./dto/create-block.dto";
import { DuplicateBlockDto } from "./dto/duplicate-block.dto";
import { UpdateBlockDto } from "./dto/update-block.dto";
import { Block } from "./entities/block.entity";

const AUDITED_BLOCK_FIELDS = [
  "name",
  "description",
  "capacity",
  "order",
] as const;

@Injectable()
export class BlocksService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly participantsService: ParticipantsService,
    private readonly auditLog: AuditLogService,
  ) {}

  private getClient(tx?: Prisma.TransactionClient) {
    return tx ?? this.prisma;
  }

  private async checkAttributeExists(
    eventId: string,
    attributeId: string,
    tx?: Prisma.TransactionClient,
  ) {
    const prisma = this.getClient(tx);
    const attribute = await prisma.attribute.findFirst({
      where: { uuid: attributeId, eventUuid: eventId },
    });

    if (attribute === null) {
      throw new NotFoundException(
        `Attribute with UUID ${attributeId} in event ${eventId} not found`,
      );
    }

    return attribute;
  }

  private async checkParentBlockExists(
    attributeId: string,
    parentUuid: string,
    tx?: Prisma.TransactionClient,
  ) {
    const prisma = this.getClient(tx);
    const parentBlock = await prisma.block.findFirst({
      where: { uuid: parentUuid, attributeUuid: attributeId },
    });

    if (parentBlock === null) {
      throw new NotFoundException(
        `Parent block with UUID ${parentUuid} not found in attribute ${attributeId}`,
      );
    }

    return parentBlock;
  }

  async create(
    eventId: string,
    attributeId: string,
    createBlockDto: CreateBlockDto,
    actor: AuditActor,
  ) {
    await this.checkAttributeExists(eventId, attributeId);
    await this.checkParentBlockExists(attributeId, createBlockDto.parentUuid);

    return this.prisma.$transaction(async (tx) => {
      const block = await tx.block.create({
        data: {
          capacity: createBlockDto.capacity,
          order: createBlockDto.order,
          name: createBlockDto.name,
          description: createBlockDto.description,
          parentUuid: createBlockDto.parentUuid,
          attributeUuid: attributeId,
        },
      });
      await this.recordBlockAudit(tx, eventId, actor, {
        action: AuditAction.BlockCreated,
        before: null,
        after: block,
      });
      return block;
    });
  }

  private async recordBlockAudit(
    tx: Prisma.TransactionClient,
    eventId: string,
    actor: AuditActor,
    change: {
      action:
        | typeof AuditAction.BlockCreated
        | typeof AuditAction.BlockUpdated
        | typeof AuditAction.BlockDeleted;
      before: Record<string, unknown> | null;
      after: Record<string, unknown> | null;
    },
  ) {
    const changes = this.auditLog.fieldChanges(
      change.before,
      change.after,
      AUDITED_BLOCK_FIELDS,
    );
    if (changes.length === 0) {
      return;
    }

    const block = change.after ?? change.before;
    await this.auditLog.record(tx, {
      eventUuid: eventId,
      action: change.action,
      actor,
      entityType: AuditEntityType.Block,
      entityUuid: block?.uuid as string | undefined,
      entityLabel: block?.name as string | undefined,
      changes,
    });
  }

  async ensureRootBlock(
    eventId: string,
    attributeId: string,
    rootName: string,
    tx: Prisma.TransactionClient,
  ) {
    const prisma = this.getClient(tx);
    await this.checkAttributeExists(eventId, attributeId, tx);

    const existingRoot = await prisma.block.findFirst({
      where: { attributeUuid: attributeId, isRootBlock: true },
      select: { uuid: true },
    });
    if (existingRoot != null) {
      return existingRoot;
    }

    return prisma.block.create({
      data: {
        name: rootName,
        description: null,
        capacity: null,
        order: 0,
        parentUuid: null,
        attributeUuid: attributeId,
        isRootBlock: true,
      },
      select: { uuid: true },
    });
  }

  async deleteRootBlocks(attributeId: string, tx: Prisma.TransactionClient) {
    const prisma = this.getClient(tx);
    return prisma.block.deleteMany({
      where: { attributeUuid: attributeId },
    });
  }

  async findAll(eventId: string, attributeId: string) {
    await this.checkAttributeExists(eventId, attributeId);

    const blocks = await this.prisma.block.findMany({
      where: { attributeUuid: attributeId },
    });

    const blocksMap = new Map<string, Block>();

    for (const block of blocks) {
      blocksMap.set(block.uuid, { ...block, children: [] });
    }

    let rootBlock: Block | null = null;

    for (const block of blocksMap.values()) {
      if (block.isRootBlock) {
        rootBlock = block;
      }
      if (block.parentUuid != null) {
        const parent = blocksMap.get(block.parentUuid);
        if (parent?.children != null) {
          parent.children.push(block);
        }
      }
    }

    if (rootBlock === null) {
      return [];
    }

    this.sortBlockTree(rootBlock);

    return rootBlock;
  }

  private sortBlockTree(block: Block) {
    if (block.children == null) {
      return;
    }

    block.children.sort((a: Block, b: Block) => {
      const orderA = a.order ?? 0;
      const orderB = b.order ?? 0;
      if (orderA !== orderB) {
        return orderA - orderB;
      }
      return a.createdAt.getTime() - b.createdAt.getTime();
    });
    for (const child of block.children) {
      this.sortBlockTree(child);
    }
  }

  async findOne(eventId: string, attributeId: string, id: string) {
    const block = await this.prisma.block.findFirst({
      where: {
        uuid: id,
        attributeUuid: attributeId,
        attribute: {
          eventUuid: eventId,
        },
      },
    });

    if (block === null) {
      throw new NotFoundException(`Block with UUID ${id} not found`);
    }

    return block;
  }

  async update(
    eventId: string,
    attributeId: string,
    id: string,
    updateBlockDto: UpdateBlockDto,
    actor: AuditActor,
  ) {
    const block = await this.findOne(eventId, attributeId, id);

    if (block.isRootBlock) {
      throw new BadRequestException("Root block cannot be modified this way");
    }

    if (updateBlockDto.parentUuid !== undefined) {
      if (updateBlockDto.parentUuid === id) {
        throw new BadRequestException("Block cannot be its own parent");
      }
      await this.checkParentBlockExists(attributeId, updateBlockDto.parentUuid);
    }

    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.block.update({
        where: { uuid: id },
        data: updateBlockDto,
      });
      await this.recordBlockAudit(tx, eventId, actor, {
        action: AuditAction.BlockUpdated,
        before: block,
        after: updated,
      });
      return updated;
    });
  }

  async duplicate(
    eventId: string,
    attributeId: string,
    id: string,
    duplicateBlockDto: DuplicateBlockDto,
    actor: AuditActor,
  ) {
    const block = await this.findOne(eventId, attributeId, id);

    if (block.isRootBlock) {
      throw new BadRequestException("Root block cannot be duplicated");
    }

    return this.prisma.$transaction(async (tx) => {
      const duplicated = await tx.block.create({
        data: {
          capacity: block.capacity,
          order: block.order,
          name: duplicateBlockDto.name ?? `${block.name} - copy`,
          description: block.description,
          parentUuid: block.parentUuid,
          attributeUuid: block.attributeUuid,
        },
      });
      await this.recordBlockAudit(tx, eventId, actor, {
        action: AuditAction.BlockCreated,
        before: null,
        after: duplicated,
      });
      return duplicated;
    });
  }

  async remove(
    eventId: string,
    attributeId: string,
    id: string,
    actor: AuditActor,
  ) {
    const block = await this.findOne(eventId, attributeId, id);

    if (block.isRootBlock) {
      throw new BadRequestException(
        "Cannot delete the root block of an attribute",
      );
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.block.delete({ where: { uuid: id } });
      await this.recordBlockAudit(tx, eventId, actor, {
        action: AuditAction.BlockDeleted,
        before: block,
        after: null,
      });
    });
  }

  async getBlockParticipantsCount(
    blockId: string,
    tx?: Prisma.TransactionClient,
  ) {
    const prisma = this.getClient(tx);
    return prisma.participantAttribute.count({
      where: {
        value: {
          array_contains: blockId,
        },
      },
    });
  }

  async canSignInToBlock(
    eventId: string,
    attributeId: string,
    blockId: string,
    tx: Prisma.TransactionClient,
  ) {
    const prisma = this.getClient(tx);

    await prisma.$queryRaw`SELECT uuid FROM "Blocks" WHERE uuid = ${blockId} FOR UPDATE`;

    const block = await prisma.block.findFirst({
      where: {
        uuid: blockId,
        attributeUuid: attributeId,
        attribute: {
          eventUuid: eventId,
        },
      },
    });

    if (block == null || block.isRootBlock) {
      return false;
    }

    if (block.capacity === null) {
      return true;
    }

    const count = await this.getBlockParticipantsCount(blockId, tx);
    return count < block.capacity;
  }

  async getBlockTree(eventSlug: string, attributeUuid: string): Promise<Block> {
    const event = await this.prisma.event.findUnique({
      where: { slug: eventSlug },
    });

    const blocks = await this.prisma.block.findMany({
      where: {
        attributeUuid,
        attribute: {
          eventUuid: event?.uuid,
        },
      },
    });

    const blockMap = new Map<
      string,
      Block & { blockParticipantCount?: number; children: Block[] }
    >();

    for (const block of blocks) {
      let blockParticipantCount: number | undefined;

      if (!block.isRootBlock) {
        blockParticipantCount = await this.getBlockParticipantsCount(
          block.uuid,
        );
      }

      blockMap.set(block.uuid, {
        ...block,
        blockParticipantCount,
        children: [],
      });
    }

    let root: Block | null = null;

    for (const block of blockMap.values()) {
      if (block.isRootBlock) {
        root = block;
      }

      if (block.parentUuid !== null) {
        blockMap.get(block.parentUuid)?.children.push(block);
      }
    }

    if (root === null) {
      throw new NotFoundException(
        `Attribute with UUID ${attributeUuid} doesn't have a block tree`,
      );
    }

    this.sortBlockTree(root);

    return root;
  }

  async getBlockParticipants(
    eventSlug: string,
    attributeUuid: string,
    blockUuid: string,
  ) {
    const event = await this.prisma.event.findUnique({
      where: { slug: eventSlug },
      select: { uuid: true },
    });

    if (event === null) {
      throw new NotFoundException(`Event with slug ${eventSlug} doesn't exist`);
    }

    const block = await this.prisma.block.findUnique({
      where: {
        uuid: blockUuid,
        attributeUuid,
        attribute: {
          eventUuid: event.uuid,
        },
      },
      select: { uuid: true, attribute: { select: { config: true } } },
    });

    if (block?.attribute == null) {
      throw new NotFoundException(`Block with UUID ${blockUuid} doesn't exist`);
    }

    const config = block.attribute.config;
    let requestedFields: string[] = [];

    if (config !== null && typeof config === "object") {
      const configJson = config as Prisma.JsonObject;
      const participantFields = configJson.participantFields;

      if (Array.isArray(participantFields)) {
        requestedFields = participantFields.filter(
          (item): item is string =>
            typeof item === "string" && item.trim().length > 0,
        );
      }
    }

    const participants =
      await this.participantsService.getPublicBlockAttributes(
        event.uuid,
        block.uuid,
        requestedFields,
      );

    return participants;
  }
}
