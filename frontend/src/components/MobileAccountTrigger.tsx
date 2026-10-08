"use client";

import { User } from "@phosphor-icons/react";
import { useState } from "react";
import type { AuthUser } from "@/components/auth/AuthProvider";
import { useAuth } from "@/components/auth/AuthProvider";
import { MobileAccountSheet } from "@/components/MobileAccountSheet";

function initial(user: AuthUser) {
  const name = `${user.first_name} ${user.last_name}`.trim();
  const source = name || user.email;
  return source.slice(0, 1).toUpperCase();
}

export function MobileAccountTrigger({ user }: { user: AuthUser | null }) {
  const { openAuth } = useAuth();
  const [open, setOpen] = useState(false);

  if (!user) {
    return (
      <button
        type="button"
        className="mobile-account-btn mobile-account-btn--guest"
        aria-label="Account"
        onClick={() => openAuth("login", "/account")}
      >
        <User size={18} weight="bold" />
      </button>
    );
  }

  return (
    <>
      <button
        type="button"
        className="mobile-account-btn"
        aria-label="Account menu"
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => setOpen(true)}
      >
        {initial(user)}
      </button>
      <MobileAccountSheet user={user} open={open} onClose={() => setOpen(false)} />
    </>
  );
}
