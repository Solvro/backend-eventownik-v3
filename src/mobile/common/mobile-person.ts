import { mobileImageUrl } from "./mobile-image.service";

export interface MobilePerson {
  participantUuid: string;
  displayName: string;
  photoUrl: string | null;
}

export const MOBILE_DEFAULT_DISPLAY_NAME = "Uczestnik";

/** Public view of a participant; works for participants who have not finished onboarding. */
export function toPerson(
  profile:
    | { displayName?: string | null; photoKey?: string | null }
    | null
    | undefined,
  participantUuid: string,
): MobilePerson {
  const displayName = profile?.displayName?.trim();
  return {
    participantUuid,
    displayName:
      displayName === undefined || displayName === ""
        ? MOBILE_DEFAULT_DISPLAY_NAME
        : displayName,
    photoUrl: mobileImageUrl(profile?.photoKey),
  };
}
