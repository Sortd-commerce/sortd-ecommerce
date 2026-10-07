"use client";

import { useEffect, useRef } from "react";

export function OtpInput({
  name = "code",
  value,
  onChange,
  disabled = false,
  invalid = false,
}: {
  name?: string;
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  invalid?: boolean;
}) {
  const refs = useRef<Array<HTMLInputElement | null>>([]);
  const digits = Array.from({ length: 6 }, (_, index) => value[index] || "");

  useEffect(() => {
    refs.current[0]?.focus();
  }, []);

  function update(next: string) {
    const cleaned = next.replace(/\D/g, "").slice(0, 6);
    onChange(cleaned);
  }

  function handleChange(index: number, raw: string) {
    const digit = raw.replace(/\D/g, "").slice(-1);
    const next = digits.map((item, idx) => (idx === index ? digit : item)).join("");
    update(next);
    if (digit && index < 5) refs.current[index + 1]?.focus();
  }

  function handleKeyDown(index: number, key: string) {
    if (key === "Backspace" && !digits[index] && index > 0) {
      refs.current[index - 1]?.focus();
    }
  }

  function handlePaste(event: React.ClipboardEvent) {
    event.preventDefault();
    update(event.clipboardData.getData("text"));
    const last = Math.min(5, event.clipboardData.getData("text").replace(/\D/g, "").length - 1);
    if (last >= 0) refs.current[last]?.focus();
  }

  return (
    <div className={`auth-otp ${invalid ? "auth-otp--invalid" : ""}`}>
      <input type="hidden" name={name} value={value} />
      {digits.map((digit, index) => (
        <input
          key={index}
          ref={(node) => {
            refs.current[index] = node;
          }}
          className="auth-otp-box"
          inputMode="numeric"
          autoComplete={index === 0 ? "one-time-code" : "off"}
          maxLength={1}
          value={digit}
          disabled={disabled}
          aria-label={`Digit ${index + 1}`}
          onChange={(event) => handleChange(index, event.target.value)}
          onKeyDown={(event) => handleKeyDown(index, event.key)}
          onPaste={handlePaste}
        />
      ))}
    </div>
  );
}
