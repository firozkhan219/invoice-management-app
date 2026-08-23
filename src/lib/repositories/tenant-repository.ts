import { assertPermission, type Permission } from "@/lib/permissions/roles";
import { requireTenantContext, type TenantContext } from "@/lib/repositories/tenant-context";

export type TenantRecord = {
  id: string;
  organisationId: string;
};

export class InMemoryTenantRepository<TRecord extends TenantRecord> {
  constructor(private readonly records: TRecord[]) {}

  list(context: TenantContext, permission: Permission): TRecord[] {
    const tenant = requireTenantContext(context);
    assertPermission(tenant.role, permission);
    return this.records.filter((record) => record.organisationId === tenant.organisationId);
  }

  findById(context: TenantContext, id: string, permission: Permission): TRecord | null {
    const tenant = requireTenantContext(context);
    assertPermission(tenant.role, permission);

    return (
      this.records.find(
        (record) => record.id === id && record.organisationId === tenant.organisationId
      ) ?? null
    );
  }

  create(context: TenantContext, permission: Permission, data: Omit<TRecord, "organisationId">): TRecord {
    const tenant = requireTenantContext(context);
    assertPermission(tenant.role, permission);

    const record = {
      ...data,
      organisationId: tenant.organisationId
    } as TRecord;

    this.records.push(record);
    return record;
  }
}
