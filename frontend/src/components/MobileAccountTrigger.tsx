"use client";

import { User } from "@phosphor-icons/react";
import { useState } from "react";
import type { AuthUser } from "@/components/auth/AuthProvider";
import { useAuth } from "@/components/auth/AuthProvider";
import { MobileAccountSheet } from "@/components/MobileAccountSheet";

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
        <User size={20} weight="regular" aria-hidden />
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
        <User size={20} weight="regular" aria-hidden />
      </button>
      <MobileAccountSheet user={user} open={open} onClose={() => setOpen(false)} />
    </>
  );
}
