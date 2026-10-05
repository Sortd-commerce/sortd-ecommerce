"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ChartLine,
  Package,
  SignOut,
  ShoppingBag,
  Truck,
  Users,
} from "@phosphor-icons/react";
import { logoutAction } from "@/lib/actions";
import type { StaffProfile } from "@/lib/staff";

const NAV = [
  { href: "/", label: "Overview", icon: ChartLine, admin: true },
  { href: "/orders", label: "Orders", icon: ShoppingBag, admin: false },
  { href: "/products", label: "Catalog", icon: Package, admin: true },
  { href: "/delivery", label: "Delivery", icon: Truck, admin: true },
  { href: "/members", label: "Members", icon: Users, admin: true },
];

export function AdminShell({ me, children }: { me: StaffProfile; children: React.ReactNode }) {
  const pathname = usePathname();
  const isAdmin = me.role === "admin";
  const links = NAV.filter((link) => isAdmin || !link.admin);
  const name = [me.first_name, me.last_name].filter(Boolean).join(" ") || me.email;

  return (
    <div className="min-h-dvh lg:grid lg:grid-cols-[240px_1fr]">
      <aside className="border-b border-line bg-sidebar lg:sticky lg:top-0 lg:flex lg:h-dvh lg:flex-col lg:border-b-0 lg:border-r">
        <div className="flex items-center justify-between gap-3 px-4 py-4 lg:block">
          <Link href={isAdmin ? "/" : "/orders"} className="block">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted">Sortd</p>
            <p className="text-sm font-semibold">Operations</p>
          </Link>
          <form action={logoutAction} className="lg:hidden">
            <button type="submit" className="btn-ghost px-3 py-1.5 text-sm">
              Log out
            </button>
          </form>
        </div>
        <nav className="flex gap-1 overflow-x-auto px-3 pb-3 lg:flex-1 lg:flex-col lg:overflow-visible lg:pb-0">
          {links.map((link) => {
            const active = link.href === "/" ? pathname === "/" : pathname.startsWith(link.href);
            const Icon = link.icon;
            return (
              <Link
                key={link.href}
                href={link.href}
                className={`nav-item ${active ? "nav-item-active" : ""}`}
                aria-current={active ? "page" : undefined}
              >
                <Icon size={18} weight={active ? "fill" : "regular"} />
                {link.label}
              </Link>
            );
          })}
        </nav>
        <div className="hidden border-t border-line p-4 lg:block">
          <p className="truncate text-sm font-medium">{name}</p>
          <p className="mt-0.5 text-xs capitalize text-muted">{me.role}</p>
          <form action={logoutAction} className="mt-3">
            <button type="submit" className="btn-ghost w-full gap-2 text-sm">
              <SignOut size={16} />
              Log out
            </button>
          </form>
        </div>
      </aside>
      <div className="min-w-0">
        <main id="main" className="mx-auto w-full max-w-[1180px] px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
          {children}
        </main>
      </div>
    </div>
  );
}
