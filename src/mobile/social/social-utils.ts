import { Prisma } from "src/generated/prisma/client";
import type { PrismaService } from "src/prisma/prisma.service";

export interface ProfileLite {
  displayName: string;
  photoKey: string | null;
}

/** One query for every profile needed by a response (no N+1). */
export async function loadProfiles(
  prisma: PrismaService,
  participantUuids: Iterable<string>,
): Promise<Map<string, ProfileLite>> {
  const uuids = [...new Set(participantUuids)];
  if (uuids.length === 0) {
    return new Map();
  }
  const profiles = await prisma.mobileProfile.findMany({
    where: { participantUuid: { in: uuids } },
    select: { participantUuid: true, displayName: true, photoKey: true },
  });
  return new Map(
    profiles.map((profile) => [
      profile.participantUuid,
      { displayName: profile.displayName, photoKey: profile.photoKey },
    ]),
  );
}

export function directRoomKey(a: string, b: string): string {
  const [lower, higher] = [a.toLowerCase(), b.toLowerCase()].toSorted();
  return `${lower}:${higher}`;
}

/** The other participant of a direct room, derived from its key. */
export function otherFromKey(key: string, me: string): string | null {
  const separator = key.indexOf(":");
  if (separator === -1) {
    return null;
  }
  const a = key.slice(0, separator);
  const b = key.slice(separator + 1);
  const mine = me.toLowerCase();
  if (a === mine) {
    return b;
  }
  return b === mine ? a : null;
}

export function isUniqueViolation(error: unknown): boolean {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P2002"
  );
}
