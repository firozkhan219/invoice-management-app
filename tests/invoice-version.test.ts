import { describe, expect, it } from "vitest";

function assertExpectedVersion(currentVersion: number, expectedVersion: number) {
  if (currentVersion !== expectedVersion) {
    throw new Error("Invoice was changed elsewhere. Refresh and try again.");
  }
}

describe("invoice optimistic versioning", () => {
  it("allows edits with the current version", () => {
    expect(() => assertExpectedVersion(3, 3)).not.toThrow();
  });

  it("rejects stale edits", () => {
    expect(() => assertExpectedVersion(4, 3)).toThrow("changed elsewhere");
  });
});
