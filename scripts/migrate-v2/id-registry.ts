import { randomUUID } from "node:crypto";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

export class IdRegistry {
  private readonly ids = new Map<string, string>();
  private readonly usedByEntity = new Map<string, Set<string>>();

  private static compose(entity: string, sourceKey: string) {
    return `${entity}\u0000${sourceKey}`;
  }

  private used(entity: string) {
    let used = this.usedByEntity.get(entity);
    if (used === undefined) {
      used = new Set();
      this.usedByEntity.set(entity, used);
    }
    return used;
  }

  preload(entity: string, sourceKey: string, targetId: string) {
    this.ids.set(IdRegistry.compose(entity, sourceKey), targetId);
    this.used(entity).add(targetId);
  }

  assign(entity: string, sourceKey: string, preferred?: string | null) {
    const composed = IdRegistry.compose(entity, sourceKey);
    const existing = this.ids.get(composed);
    if (existing !== undefined) {
      return existing;
    }

    const used = this.used(entity);
    const candidate = preferred?.trim().toLowerCase();
    const targetId =
      candidate !== undefined &&
      UUID_PATTERN.test(candidate) &&
      !used.has(candidate)
        ? candidate
        : randomUUID();

    this.ids.set(composed, targetId);
    used.add(targetId);
    return targetId;
  }

  get(entity: string, sourceKey: string) {
    return this.ids.get(IdRegistry.compose(entity, sourceKey));
  }

  require(entity: string, sourceKey: string) {
    const targetId = this.get(entity, sourceKey);
    if (targetId === undefined) {
      throw new Error(`${entity} ${sourceKey} does not exist in v2`);
    }
    return targetId;
  }
}
