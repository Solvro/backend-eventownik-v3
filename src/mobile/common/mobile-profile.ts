import { mobileImageUrl } from "./mobile-image.service";

export interface MobileProfileView {
  participantUuid: string;
  displayName: string;
  bio: string | null;
  photoUrl: string | null;
  tinderOptIn: boolean;
}

export interface MobileMeView {
  participant: { uuid: string; email: string };
  profile: MobileProfileView | null;
}

export const MOBILE_PROFILE_SELECT = {
  participantUuid: true,
  displayName: true,
  bio: true,
  photoKey: true,
  tinderOptIn: true,
} as const;

interface MobileProfileRow {
  participantUuid: string;
  displayName: string;
  bio: string | null;
  photoKey: string | null;
  tinderOptIn: boolean;
}

export function toProfileView(profile: MobileProfileRow): MobileProfileView;
export function toProfileView(
  profile: MobileProfileRow | null,
): MobileProfileView | null;
export function toProfileView(
  profile: MobileProfileRow | null,
): MobileProfileView | null {
  if (profile === null) {
    return null;
  }
  return {
    participantUuid: profile.participantUuid,
    displayName: profile.displayName,
    bio: profile.bio,
    photoUrl: mobileImageUrl(profile.photoKey),
    tinderOptIn: profile.tinderOptIn,
  };
}
