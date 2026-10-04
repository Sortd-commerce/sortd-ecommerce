"use client";

import { useState } from "react";

export function PasswordField({
  name = "password",
  autoComplete = "current-password",
  minLength,
  required = true,
  label = "Password",
}: {
  name?: string;
  autoComplete?: string;
  minLength?: number;
  required?: boolean;
  label?: string;
}) {
  const [visible, setVisible] = useState(false);
  return (
    <label className="field">
      <span>{label}</span>
      <span className="relative block">
        <input name={name} type={visible ? "text" : "password"} autoComplete={autoComplete} minLength={minLength} required={required} />
        <button
          type="button"
          className="absolute right-2 top-1/2 -translate-y-1/2 text-xs font-semibold text-accent"
          onClick={() => setVisible((value) => !value)}
          aria-pressed={visible}
          aria-label={visible ? "Hide password" : "Show password"}
        >
          {visible ? "Hide" : "Show"}
        </button>
      </span>
    </label>
  );
}
