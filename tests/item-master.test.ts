import { describe, expect, it } from "vitest";
import { applySingleDefault } from "@/lib/items/default-master";
import { InMemoryTenantRepository, type TenantRecord } from "@/lib/repositories/tenant-repository";
import type { TenantContext } from "@/lib/repositories/tenant-context";

type MasterLike = TenantRecord & {
  name: string;
  isDefault: boolean;
};

const ownerA: TenantContext = {
  userId: "user-a",
  organisationId: "org-a",
  role: "owner"
};

const ownerB: TenantContext = {
  userId: "user-b",
  organisationId: "org-b",
  role: "owner"
};

describe("item master defaults", () => {
  it("keeps only one default inside the same organisation", () => {
    const records: MasterLike[] = [
      { id: "pcs", organisationId: "org-a", name: "Pieces", isDefault: true },
      { id: "box", organisationId: "org-a", name: "Boxes", isDefault: true },
      { id: "kg", organisationId: "org-b", name: "Kilograms", isDefault: true }
    ];

    expect(applySingleDefault(records, records[1])).toEqual([
      { id: "pcs", organisationId: "org-a", name: "Pieces", isDefault: false },
      records[1],
      records[2]
    ]);
  });
});

describe("item master tenant isolation", () => {
  it("blocks lookup of another organisation item-like record", () => {
    const repo = new InMemoryTenantRepository<MasterLike>([
      { id: "item-a", organisationId: "org-a", name: "Item A", isDefault: false },
      { id: "item-b", organisationId: "org-b", name: "Item B", isDefault: false }
    ]);

    expect(repo.findById(ownerA, "item-b", "masters:read")).toBeNull();
    expect(repo.findById(ownerB, "item-b", "masters:read")?.name).toBe("Item B");
  });
});
