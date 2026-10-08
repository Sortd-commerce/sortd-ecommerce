"use client";

import { User } from "@phosphor-icons/react";
import { usePathname } from "next/navigation";
import { useState } from "react";
import type { AuthUser } from "@/components/auth/AuthProvider";
import { useAuth } from "@/components/auth/AuthProvider";
import { MobileAccountSheet } from "@/components/MobileAccountSheet";

function firstName(user: AuthUser) {
  return user.first_name.trim() || user.email.split("@")[0];
}

export function MobileAccountTrigger({ user }: { user: AuthUser | null }) {
  const { openAuth } = useAuth();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const authNext = pathname.startsWith("/checkout") ? "/checkout" : pathname || "/";

  if (!user) {
    return (
      <button
        type="button"
        className="mobile-account-btn mobile-account-btn--guest"
        aria-label="Account"
        onClick={() => openAuth("login", authNext)}
      >
        <User size={20} weight="regular" aria-hidden />
      </button>
    );
  }

  return (
    <>
      <button
        type="button"
        className="mobile-account-btn mobile-account-btn--member"
        aria-label="Account menu"
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => setOpen(true)}
      >
        <User size={18} weight="regular" aria-hidden />
        <span className="mobile-account-btn__label">Hi, {firstName(user)}</span>
      </button>
      <MobileAccountSheet user={user} open={open} onClose={() => setOpen(false)} />
    </>
  );
}
