"use client";

import Link from "next/link";
import { CaretDown } from "@phosphor-icons/react";
import { useEffect, useRef, useState } from "react";
import { AccountIcon } from "@/components/HeaderIcons";
import type { AuthUser } from "@/components/auth/AuthProvider";
import { useAuth } from "@/components/auth/AuthProvider";
import { logoutAction } from "@/lib/actions";

function displayName(user: AuthUser) {
  const name = `${user.first_name} ${user.last_name}`.trim();
  return name || user.email.split("@")[0];
}

function firstName(user: AuthUser) {
  return user.first_name.trim() || user.email.split("@")[0];
}

export function AccountMenu({ user }: { user: AuthUser | null }) {
  const { openAuth } = useAuth();
  const [open, setOpen] = useState(false);
  const [activeOrders, setActiveOrders] = useState(0);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open || !user) return;
    let cancelled = false;
    fetch("/api/account/orders-summary", { credentials: "include" })
      .then((response) => (response.ok ? response.json() : null))
      .then((data) => {
        if (!cancelled && data?.active_count != null) setActiveOrders(data.active_count);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [open, user]);

  useEffect(() => {
    if (!open) return;
    const onPointer = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    window.addEventListener("mousedown", onPointer);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("mousedown", onPointer);
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  if (!user) {
    return (
      <button
        type="button"
        className="header-account"
        aria-label="Account"
        onClick={() => openAuth("login", "/account")}
      >
        <AccountIcon />
      </button>
    );
  }

  return (
    <div className="account-menu" ref={rootRef}>
      <button
        type="button"
        className="account-menu-trigger"
        aria-expanded={open}
        aria-haspopup="menu"
        onClick={() => setOpen((value) => !value)}
      >
        Hi, {firstName(user)}
        <CaretDown size={14} weight="bold" aria-hidden />
      </button>
      {open ? (
        <div className="account-menu-panel" role="menu">
          <div className="account-menu-head">
            <strong>{displayName(user)}</strong>
            <span>{user.email}</span>
          </div>
          <Link href="/orders" className="account-menu-item" role="menuitem" onClick={() => setOpen(false)}>
            <span>My orders</span>
            {activeOrders > 0 ? <span className="account-menu-badge">{activeOrders} on the way</span> : null}
          </Link>
          <Link href="/addresses" className="account-menu-item" role="menuitem" onClick={() => setOpen(false)}>
            Saved addresses
          </Link>
          <Link href="/account" className="account-menu-item" role="menuitem" onClick={() => setOpen(false)}>
            Membership
          </Link>
          <form action={logoutAction}>
            <button type="submit" className="account-menu-item account-menu-item--danger" role="menuitem">
              Log out
            </button>
          </form>
        </div>
      ) : null}
    </div>
  );
}
