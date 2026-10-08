"use client";

import Link from "next/link";
import { X } from "@phosphor-icons/react";
import { useEffect, useState } from "react";
import type { AuthUser } from "@/components/auth/AuthProvider";
import { logoutAction } from "@/lib/actions";

function displayName(user: AuthUser) {
  const name = `${user.first_name} ${user.last_name}`.trim();
  return name || user.email.split("@")[0];
}

export function MobileAccountSheet({
  user,
  open,
  onClose,
}: {
  user: AuthUser;
  open: boolean;
  onClose: () => void;
}) {
  const [activeOrders, setActiveOrders] = useState(0);

  useEffect(() => {
    if (!open) return;
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
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = previous;
      window.removeEventListener("keydown", onKey);
    };
  }, [onClose, open]);

  if (!open) return null;

  return (
    <div className="account-sheet-layer">
      <button type="button" className="account-sheet-scrim" aria-label="Close account menu" onClick={onClose} />
      <aside className="account-sheet" role="dialog" aria-modal="true" aria-label="Account menu">
        <span className="sheet-handle" aria-hidden />
        <button type="button" className="account-sheet-close" aria-label="Close" onClick={onClose}>
          <X size={18} weight="bold" />
        </button>
        <div className="account-sheet-head">
          <strong>{displayName(user)}</strong>
          <span>{user.email}</span>
        </div>
        <div className="account-sheet-items">
          <Link href="/orders" className="account-sheet-item account-sheet-item--orders" onClick={onClose}>
            <span>My orders</span>
            {activeOrders > 0 ? <span className="account-sheet-badge">{activeOrders} on the way</span> : null}
          </Link>
          <Link href="/addresses" className="account-sheet-item" onClick={onClose}>
            Saved addresses
          </Link>
        </div>
        <form action={logoutAction} className="account-sheet-logout">
          <button type="submit" className="account-sheet-item account-sheet-item--logout">
            Log out
          </button>
        </form>
      </aside>
    </div>
  );
}
