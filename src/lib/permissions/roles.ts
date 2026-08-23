export type MemberRole = "owner" | "admin" | "accountant" | "viewer";

export type Permission =
  | "organisation:read"
  | "organisation:update"
  | "organisation:delete"
  | "members:read"
  | "members:manage"
  | "masters:read"
  | "masters:manage"
  | "invoices:read"
  | "invoices:create"
  | "invoices:issue"
  | "invoices:cancel"
  | "payments:read"
  | "payments:manage"
  | "reports:read"
  | "documents:download";

const rolePermissions: Record<MemberRole, ReadonlySet<Permission>> = {
  owner: new Set([
    "organisation:read",
    "organisation:update",
    "organisation:delete",
    "members:read",
    "members:manage",
    "masters:read",
    "masters:manage",
    "invoices:read",
    "invoices:create",
    "invoices:issue",
    "invoices:cancel",
    "payments:read",
    "payments:manage",
    "reports:read",
    "documents:download"
  ]),
  admin: new Set([
    "organisation:read",
    "organisation:update",
    "members:read",
    "members:manage",
    "masters:read",
    "masters:manage",
    "invoices:read",
    "invoices:create",
    "invoices:issue",
    "invoices:cancel",
    "payments:read",
    "payments:manage",
    "reports:read",
    "documents:download"
  ]),
  accountant: new Set([
    "organisation:read",
    "masters:read",
    "invoices:read",
    "invoices:create",
    "invoices:issue",
    "payments:read",
    "payments:manage",
    "reports:read",
    "documents:download"
  ]),
  viewer: new Set([
    "organisation:read",
    "masters:read",
    "invoices:read",
    "payments:read",
    "reports:read",
    "documents:download"
  ])
};

export function hasPermission(role: MemberRole, permission: Permission): boolean {
  return rolePermissions[role].has(permission);
}

export function assertPermission(role: MemberRole, permission: Permission): void {
  if (!hasPermission(role, permission)) {
    throw new Error(`Permission denied: ${permission}`);
  }
}

export function permissionsForRole(role: MemberRole): Permission[] {
  return Array.from(rolePermissions[role]).sort();
}
