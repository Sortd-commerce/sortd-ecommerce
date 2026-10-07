"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { CaretDown } from "@phosphor-icons/react";
import type { Icon } from "@phosphor-icons/react";

export function NavGroup({
  label,
  icon: IconComponent,
  items,
}: {
  label: string;
  icon: Icon;
  items: Array<{ href: string; label: string }>;
}) {
  const pathname = usePathname();
  const active = items.some((item) => pathname.startsWith(item.href));
  const [open, setOpen] = useState(active);

  return (
    <div className="nav-group">
      <button
        type="button"
        className={`nav-group-toggle ${active ? "nav-group-toggle-active" : ""}`}
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
      >
        <span className="nav-group-label">
          <IconComponent size={18} weight={active ? "fill" : "regular"} />
          {label}
        </span>
        <CaretDown size={14} className={`nav-group-caret ${open ? "nav-group-caret-open" : ""}`} />
      </button>
      {open ? (
        <div className="nav-group-items">
          {items.map((item) => {
            const itemActive = pathname === item.href || pathname.startsWith(`${item.href}/`);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`nav-subitem ${itemActive ? "nav-subitem-active" : ""}`}
                aria-current={itemActive ? "page" : undefined}
              >
                {item.label}
              </Link>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
