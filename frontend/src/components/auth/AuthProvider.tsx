"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { AuthModal } from "@/components/auth/AuthModal";
import { useToast } from "@/components/Toast";
import { safeRedirectPath } from "@/lib/redirect";

export type AuthUser = {
  email: string;
  first_name: string;
  last_name: string;
};

type AuthStep = "signup" | "signup-code" | "login" | "login-code";

type AuthContextValue = {
  user: AuthUser | null;
  openAuth: (mode: "signup" | "login", next?: string) => void;
  closeAuth: () => void;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) {
    return {
      user: null,
      openAuth: () => undefined,
      closeAuth: () => undefined,
    };
  }
  return value;
}

export function AuthProvider({
  user,
  children,
}: {
  user: AuthUser | null;
  children: React.ReactNode;
}) {
  const router = useRouter();
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<AuthStep>("login");
  const [email, setEmail] = useState("");
  const [nextPath, setNextPath] = useState("");

  const openAuth = useCallback((mode: "signup" | "login", next = "") => {
    setStep(mode);
    setEmail("");
    setNextPath(next);
    setOpen(true);
  }, []);

  const closeAuth = useCallback(() => {
    setOpen(false);
  }, []);

  const onCodeSent = useCallback((sentEmail: string, purpose: "signup" | "login") => {
    setEmail(sentEmail);
    setStep(purpose === "signup" ? "signup-code" : "login-code");
  }, []);

  const onVerified = useCallback(
    (firstName: string, purpose: "signup" | "login") => {
      setOpen(false);
      const greeting = firstName.trim() || "there";
      toast.success(
        purpose === "signup" ? `You're in. Welcome, ${greeting}.` : `You're logged in. Welcome back, ${greeting}.`,
      );
      router.replace(safeRedirectPath(nextPath));
      router.refresh();
    },
    [nextPath, router, toast],
  );

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const auth = params.get("auth");
    if (auth === "login" || auth === "signup") {
      openAuth(auth, params.get("next") || "");
      params.delete("auth");
      params.delete("next");
      const query = params.toString();
      const nextUrl = `${window.location.pathname}${query ? `?${query}` : ""}${window.location.hash}`;
      window.history.replaceState(null, "", nextUrl);
    }
  }, [openAuth]);

  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") closeAuth();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = previous;
      window.removeEventListener("keydown", onKey);
    };
  }, [closeAuth, open]);

  const value = useMemo(() => ({ user, openAuth, closeAuth }), [closeAuth, openAuth, user]);

  return (
    <AuthContext.Provider value={value}>
      {children}
      {open ? (
        <AuthModal
          step={step}
          email={email}
          nextPath={nextPath}
          onClose={closeAuth}
          onSwitch={(target, prefillEmail) => {
            if (prefillEmail) setEmail(prefillEmail.trim().toLowerCase());
            setStep(target);
          }}
          onCodeSent={onCodeSent}
          onVerified={onVerified}
          onChangeEmail={() => setStep(step.startsWith("signup") ? "signup" : "login")}
        />
      ) : null}
    </AuthContext.Provider>
  );
}
