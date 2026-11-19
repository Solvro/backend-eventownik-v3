import { OpenCondition } from "src/generated/prisma/enums";

import { isFormCurrentlyOpen } from "./is-form-currently-open";

const now = new Date("2026-11-18T12:00:00.000Z");
const before = new Date("2026-11-15T12:00:00.000Z");
const after = new Date("2026-11-21T12:00:00.000Z");

const form = {
  uuid: "form-1",
  isOpen: true,
  openCondition: OpenCondition.MANUAL,
  openDate: null,
  closeDate: null,
  closeOnParticipantsLimit: true,
};

const event = {
  registerFormUuid: "form-1",
  participantsLimit: 10,
  participantsCount: 3,
};

describe("isFormCurrentlyOpen", () => {
  it("follows isOpen for MANUAL forms", () => {
    expect(isFormCurrentlyOpen(form, event, now)).toBe(true);
    expect(isFormCurrentlyOpen({ ...form, isOpen: false }, event, now)).toBe(
      false,
    );
  });

  it("follows the date window for ON_DATE forms", () => {
    const onDate = {
      ...form,
      openCondition: OpenCondition.ON_DATE,
      openDate: before,
      closeDate: after,
    };
    expect(isFormCurrentlyOpen(onDate, event, now)).toBe(true);
    expect(
      isFormCurrentlyOpen({ ...onDate, openDate: after }, event, now),
    ).toBe(false);
    expect(
      isFormCurrentlyOpen({ ...onDate, closeDate: before }, event, now),
    ).toBe(false);
  });

  it("treats a missing openDate as already open and a missing closeDate as closed", () => {
    const onDate = {
      ...form,
      openCondition: OpenCondition.ON_DATE,
      closeDate: after,
    };
    expect(isFormCurrentlyOpen(onDate, event, now)).toBe(true);
    expect(
      isFormCurrentlyOpen({ ...onDate, closeDate: null }, event, now),
    ).toBe(false);
  });

  describe("participants limit", () => {
    const full = { ...event, participantsCount: 10 };

    it("closes the register form when the limit is reached", () => {
      expect(isFormCurrentlyOpen(form, full, now)).toBe(false);
    });

    it("stays open when closeOnParticipantsLimit is false", () => {
      expect(
        isFormCurrentlyOpen(
          { ...form, closeOnParticipantsLimit: false },
          full,
          now,
        ),
      ).toBe(true);
    });

    it("stays open when the event has no limit", () => {
      expect(
        isFormCurrentlyOpen(form, { ...full, participantsLimit: null }, now),
      ).toBe(true);
    });

    it("ignores the limit for forms other than the register form", () => {
      expect(
        isFormCurrentlyOpen(form, { ...full, registerFormUuid: "other" }, now),
      ).toBe(true);
    });
  });
});
