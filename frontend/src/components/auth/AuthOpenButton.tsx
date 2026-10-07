"use client";

import Link from "next/link";
import { useAuth } from "@/components/auth/AuthProvider";

export function AuthOpenButton({
  mode = "login",
  next = "",
  className,
  children,
}: {
  mode?: "signup" | "login";
  next?: string;
  className?: string;
  children: React.ReactNode;
}) {
  const { openAuth, user } = useAuth();
  if (user) {
    return (
      <Link href={next || "/account"} className={className}>
        {children}
      </Link>
    );
  }
  return (
    <button type="button" className={className} onClick={() => openAuth(mode, next)}>
      {children}
    </button>
  );
}
