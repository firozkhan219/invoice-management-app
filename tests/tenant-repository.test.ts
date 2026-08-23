import { describe, expect, it } from "vitest";
import { InMemoryTenantRepository, type TenantRecord } from "@/lib/repositories/tenant-repository";
import type { TenantContext } from "@/lib/repositories/tenant-context";

type BuyerLike = TenantRecord & {
  name: string;
};

const ownerA: TenantContext = {
  userId: "user-a",
  organisationId: "org-a",
  role: "owner"
};

const viewerA: TenantContext = {
  userId: "viewer-a",
  organisationId: "org-a",
  role: "viewer"
};

const ownerB: TenantContext = {
  userId: "user-b",
  organisationId: "org-b",
  role: "owner"
};

describe("tenant repository boundary", () => {
  it("lists only records belonging to the active organisation", () => {
    const repo = new InMemoryTenantRepository<BuyerLike>([
      { id: "buyer-a", organisationId: "org-a", name: "Buyer A" },
      { id: "buyer-b", organisationId: "org-b", name: "Buyer B" }
    ]);

    expect(repo.list(ownerA, "masters:read")).toEqual([
      { id: "buyer-a", organisationId: "org-a", name: "Buyer A" }
    ]);
    expect(repo.list(ownerB, "masters:read")).toEqual([
      { id: "buyer-b", organisationId: "org-b", name: "Buyer B" }
    ]);
  });

  it("blocks direct lookup of another tenant record", () => {
    const repo = new InMemoryTenantRepository<BuyerLike>([
      { id: "buyer-a", organisationId: "org-a", name: "Buyer A" },
      { id: "buyer-b", organisationId: "org-b", name: "Buyer B" }
    ]);

    expect(repo.findById(ownerA, "buyer-b", "masters:read")).toBeNull();
  });

  it("forces created records into the server-derived tenant context", () => {
    const repo = new InMemoryTenantRepository<BuyerLike>([]);

    expect(repo.create(ownerA, "masters:manage", { id: "buyer-new", name: "New Buyer" })).toEqual({
      id: "buyer-new",
      organisationId: "org-a",
      name: "New Buyer"
    });
  });

  it("enforces write permissions server-side", () => {
    const repo = new InMemoryTenantRepository<BuyerLike>([]);

    expect(() =>
      repo.create(viewerA, "masters:manage", { id: "buyer-new", name: "New Buyer" })
    ).toThrow("Permission denied");
  });

  it("keeps company and bank-like records scoped to their organisation", () => {
    const repo = new InMemoryTenantRepository<BuyerLike>([
      { id: "company-a", organisationId: "org-a", name: "Company A" },
      { id: "bank-b", organisationId: "org-b", name: "Bank B" }
    ]);

    expect(repo.findById(ownerA, "bank-b", "masters:read")).toBeNull();
    expect(repo.findById(ownerB, "bank-b", "masters:read")?.name).toBe("Bank B");
  });

  it("keeps buyer-like records scoped to their organisation", () => {
    const repo = new InMemoryTenantRepository<BuyerLike>([
      { id: "buyer-a", organisationId: "org-a", name: "Buyer A" },
      { id: "buyer-b", organisationId: "org-b", name: "Buyer B" }
    ]);

    expect(repo.findById(ownerA, "buyer-b", "masters:read")).toBeNull();
    expect(repo.findById(ownerB, "buyer-b", "masters:read")?.name).toBe("Buyer B");
  });
});
