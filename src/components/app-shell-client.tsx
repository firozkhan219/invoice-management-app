"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Building2,
  CreditCard,
  FileMinus2,
  FileBarChart,
  FileText,
  Gauge,
  Menu,
  PackageCheck,
  Package,
  PanelLeftClose,
  PanelLeftOpen,
  Settings,
  Plus,
  ChevronRight,
  ShieldCheck,
  UserRound,
  X,
  Users
} from "lucide-react";
import { FlashMessage } from "@/components/flash-message";
import { useEffect, useState, useSyncExternalStore } from "react";

const navItems = [
  { label: "Dashboard", href: "/dashboard", icon: Gauge },
  { label: "Invoices", href: "/invoices", icon: FileText },
  { label: "Credit Notes", href: "/credit-notes", icon: FileMinus2 },
  { label: "Packing Lists", href: "/packing-lists", icon: PackageCheck },
  { label: "Payments", href: "/payments", icon: CreditCard },
  { label: "Buyers", href: "/buyers", icon: Users },
  { label: "Items", href: "/items", icon: Package },
  { label: "Companies", href: "/companies", icon: Building2 },
  { label: "Reports", href: "/reports", icon: FileBarChart },
  { label: "Users & Roles", href: "/members", icon: ShieldCheck },
  { label: "Settings", href: "/settings", icon: Settings },
  { label: "My account", href: "/account", icon: UserRound }
];

export type ShellAccount = {
  displayName: string;
  role: string | null;
  activeOrganisationId: string | null;
  organisations: Array<{ id: string; name: string }>;
};

const sidebarPreference = "app-sidebar-collapsed";
function subscribeSidebar(callback: () => void) {
  window.addEventListener("storage", callback);
  window.addEventListener("sidebar-preference", callback);
  return () => {
    window.removeEventListener("storage", callback);
    window.removeEventListener("sidebar-preference", callback);
  };
}
function getSidebarSnapshot() {
  try { return window.localStorage.getItem(sidebarPreference) === "true"; }
  catch { return false; }
}
function getServerSidebarSnapshot() { return false; }

export function AppShellClient({ children, account }: { children: React.ReactNode; account: ShellAccount | null }) {
  const pathname = usePathname();
  const collapsed = useSyncExternalStore(subscribeSidebar, getSidebarSnapshot, getServerSidebarSnapshot);
  const [mobilePath, setMobilePath] = useState<string | null>(null);
  const mobileOpen = mobilePath === pathname;
  const currentPage = navItems.find((item) => pathname === item.href || pathname.startsWith(`${item.href}/`))?.label || "Workspace";

  function toggleSidebar() {
    try {
      window.localStorage.setItem(sidebarPreference, String(!collapsed));
      window.dispatchEvent(new Event("sidebar-preference"));
    } catch { /* Navigation remains available if storage is disabled. */ }
  }

  useEffect(() => {
    if (!mobileOpen) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setMobilePath(null);
    }
    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [mobileOpen]);

  return (
    <div className={`shell${collapsed ? " sidebar-collapsed" : ""}${mobileOpen ? " sidebar-mobile-open" : ""}`}>
      <a className="skip-link" href="#main-content">Skip to content</a>
      <button
        aria-label="Open navigation"
        className="sidebar-mobile-toggle"
        aria-expanded={mobileOpen}
        aria-controls="workspace-sidebar"
        onClick={() => setMobilePath(pathname)}
        type="button"
      >
        <Menu size={20} />
      </button>
      <aside className="sidebar" id="workspace-sidebar">
        <div className="sidebar-header">
          <div className="brand">
            <span className="brand-mark">IM</span>
            <span className="sidebar-label brand-name">Invoice<span>Management workspace</span></span>
          </div>
          <button
            aria-label={collapsed ? "Expand navigation" : "Collapse navigation"}
            className="sidebar-toggle"
            onClick={toggleSidebar}
            title={collapsed ? "Expand navigation" : "Collapse navigation"}
            type="button"
          >
            {collapsed ? <PanelLeftOpen size={18} /> : <PanelLeftClose size={18} />}
          </button>
          <button
            aria-label="Close navigation"
            className="sidebar-toggle sidebar-close"
            onClick={() => setMobilePath(null)}
            title="Close navigation"
            type="button"
          >
            <X size={18} />
          </button>
        </div>
        <Link className="sidebar-create" href="/invoices/new" title="Create invoice" onClick={() => setMobilePath(null)}>
          <Plus size={18} /><span className="sidebar-label">Create invoice</span>
        </Link>
        <nav className="nav" aria-label="Main navigation">
          {navItems.map((item, index) => {
            const Icon = item.icon;
            const active = item.href !== "/dashboard"
              ? pathname === item.href || pathname.startsWith(`${item.href}/`)
              : pathname === item.href;

            return (
              <div key={item.label}>
              {(index === 0 || index === 5 || index === 8) && <p className="nav-group sidebar-label">{index === 0 ? "Workspace" : index === 5 ? "Business records" : "Manage"}</p>}
              <Link onClick={() => setMobilePath(null)} aria-current={active ? "page" : undefined} className={active ? "active" : undefined} href={item.href} title={item.label}>
                <Icon size={18} />
                <span className="sidebar-label">{item.label}</span>
              </Link>
              </div>
            );
          })}
        </nav>
        <div className="sidebar-footer sidebar-label">
          {account && account.organisations.length > 1 ? (
            <form action="/api/organisations/switch" method="post" className="sidebar-org-switch">
              <label htmlFor="organisation-switch">Organisation</label>
              <select id="organisation-switch" name="organisationId" defaultValue={account.activeOrganisationId ?? undefined}>
                {account.organisations.map((organisation) => (
                  <option key={organisation.id} value={organisation.id}>{organisation.name}</option>
                ))}
              </select>
              <button className="button subtle tiny" type="submit">Switch</button>
            </form>
          ) : null}
          {account ? (
            <span><span className="workspace-dot" /> {account.displayName}{account.role ? ` · ${account.role}` : ""}</span>
          ) : (
            <span><span className="workspace-dot" /> Your business, organised.</span>
          )}
        </div>
      </aside>
      <button
        aria-label="Close navigation overlay"
        className="sidebar-backdrop"
        onClick={() => setMobilePath(null)}
        type="button"
      />
      <div className="workspace-main">
        <header className="workspace-topbar"><div className="workspace-breadcrumb"><span>Workspace</span><ChevronRight size={14} /><strong>{currentPage}</strong></div><div className="toolbar"><Link href="/settings" className="workspace-settings"><Settings size={16} /><span>Settings</span></Link><form action="/api/auth/logout" method="post"><button className="button subtle tiny" type="submit">Sign out</button></form></div></header>
        <main className="content" id="main-content" tabIndex={-1}><FlashMessage />{children}</main>
      </div>
    </div>
  );
}
