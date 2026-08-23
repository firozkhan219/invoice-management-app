import { describe, expect, it } from "vitest";
import { applyDefaultAddressSelection } from "@/lib/buyers/default-address";
import { InMemoryTenantRepository, type TenantRecord } from "@/lib/repositories/tenant-repository";
import type { TenantContext } from "@/lib/repositories/tenant-context";

type AddressLike = TenantRecord & {
  buyerId: string;
  isBillingDefault: boolean;
  isShippingDefault: boolean;
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

describe("buyer address defaults", () => {
  it("allows one default billing address per buyer", () => {
    const addresses: AddressLike[] = [
      {
        id: "address-1",
        organisationId: "org-a",
        buyerId: "buyer-a",
        isBillingDefault: true,
        isShippingDefault: false
      },
      {
        id: "address-2",
        organisationId: "org-a",
        buyerId: "buyer-a",
        isBillingDefault: true,
        isShippingDefault: true
      }
    ];

    expect(applyDefaultAddressSelection(addresses, addresses[1])).toEqual([
      {
        id: "address-1",
        organisationId: "org-a",
        buyerId: "buyer-a",
        isBillingDefault: false,
        isShippingDefault: false
      },
      addresses[1]
    ]);
  });

  it("does not unset defaults for a different buyer", () => {
    const addresses: AddressLike[] = [
      {
        id: "address-1",
        organisationId: "org-a",
        buyerId: "buyer-a",
        isBillingDefault: true,
        isShippingDefault: true
      },
      {
        id: "address-2",
        organisationId: "org-a",
        buyerId: "buyer-b",
        isBillingDefault: true,
        isShippingDefault: true
      }
    ];

    expect(applyDefaultAddressSelection(addresses, addresses[1])[0]).toEqual(addresses[0]);
  });
});

describe("buyer tenant isolation", () => {
  it("blocks lookup of buyer addresses from another organisation", () => {
    const repo = new InMemoryTenantRepository<AddressLike>([
      {
        id: "address-a",
        organisationId: "org-a",
        buyerId: "buyer-a",
        isBillingDefault: true,
        isShippingDefault: true
      },
      {
        id: "address-b",
        organisationId: "org-b",
        buyerId: "buyer-b",
        isBillingDefault: true,
        isShippingDefault: true
      }
    ]);

    expect(repo.findById(ownerA, "address-b", "masters:read")).toBeNull();
    expect(repo.findById(ownerB, "address-b", "masters:read")?.buyerId).toBe("buyer-b");
  });
});
