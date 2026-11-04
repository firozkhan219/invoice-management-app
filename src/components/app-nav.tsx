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
  Package,
  Settings,
  ShieldCheck,
  UserRound,
  Users
} from "lucide-react";

const navItems = [
  { label: "Dashboard", href: "/dashboard", icon: Gauge },
  { label: "Invoices", href: "/invoices", icon: FileText },
  { label: "Credit Notes", href: "/credit-notes", icon: FileMinus2 },
  { label: "Payments", href: "/payments", icon: CreditCard },
  { label: "Buyers", href: "/buyers", icon: Users },
  { label: "Items", href: "/items", icon: Package },
  { label: "Companies", href: "/companies", icon: Building2 },
  { label: "Reports", href: "/reports", icon: FileBarChart },
  { label: "Users & Roles", href: "/members", icon: ShieldCheck },
  { label: "Settings", href: "/settings", icon: Settings },
  { label: "My account", href: "/account", icon: UserRound }
];

export function AppNav() {
  const pathname = usePathname();

  return (
    <nav className="nav" aria-label="Main navigation">
      {navItems.map((item) => {
        const Icon = item.icon;
        const active = pathname === item.href || pathname.startsWith(`${item.href}/`);

        return (
          <Link aria-current={active ? "page" : undefined} className={active ? "active" : undefined} href={item.href} key={item.label}>
            <Icon size={18} />
            <span>{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
