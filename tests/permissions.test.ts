import { describe, expect, it } from "vitest";
import { hasPermission, permissionsForRole } from "@/lib/permissions/roles";

describe("permission matrix", () => {
  it("allows owners to manage organisation deletion", () => {
    expect(hasPermission("owner", "organisation:delete")).toBe(true);
  });

  it("does not allow admins to transfer/delete ownership-level organisation state", () => {
    expect(hasPermission("admin", "organisation:delete")).toBe(false);
  });

  it("keeps viewers read-only", () => {
    expect(hasPermission("viewer", "invoices:read")).toBe(true);
    expect(hasPermission("viewer", "invoices:create")).toBe(false);
    expect(hasPermission("viewer", "payments:manage")).toBe(false);
  });

  it("returns deterministic permission lists", () => {
    expect(permissionsForRole("accountant")).toEqual([...permissionsForRole("accountant")].sort());
  });
});
