"use client";

import { Minus, Plus } from "@phosphor-icons/react";
import { MAX_QTY } from "@/lib/cart-store";

export function QuantityStepper({
  value,
  max,
  min = 1,
  onChange,
  size = "md",
  disabled,
  tone = "default",
  variant = "default",
}: {
  value: number;
  max?: number | null;
  min?: number;
  onChange: (next: number) => void;
  size?: "sm" | "md";
  disabled?: boolean;
  tone?: "default" | "inverse";
  variant?: "default" | "buy";
}) {
  const floor = Math.max(0, Math.floor(min));
  const cap = max == null || !Number.isFinite(Number(max)) ? MAX_QTY : Math.max(0, Math.min(MAX_QTY, Math.floor(Number(max))));
  const atMin = value <= floor;
  const atMax = value >= cap || cap < 1;
  const pad = size === "sm" ? "h-8 w-8" : "h-10 w-10";
  const text = size === "sm" ? "min-w-8 text-sm" : "min-w-10 text-base";

  const inverse = tone === "inverse";

  const useTextControls = variant === "buy" || (inverse && size === "sm");

  return (
    <div
      className={`qty-stepper ${variant === "buy" ? "qty-stepper--buy" : ""} ${inverse ? "qty-on-dark" : ""} ${disabled ? "opacity-55" : ""}`}
      role="group"
      aria-label="Quantity"
    >
      <button
        type="button"
        className={`qty-btn ${useTextControls ? "qty-btn-text" : pad}`}
        aria-label={value <= 1 && floor < 1 ? "Remove item" : "Decrease quantity"}
        disabled={disabled || atMin}
        onClick={() => onChange(Math.max(floor, value - 1))}
      >
        {useTextControls ? "−" : <Minus size={size === "sm" ? 14 : 16} weight="bold" />}
      </button>
      <span className={`qty-value ${variant === "buy" ? "qty-value--buy" : text}`} aria-live="polite">
        {value}
      </span>
      <button
        type="button"
        className={`qty-btn ${useTextControls ? "qty-btn-text" : pad}`}
        aria-label="Increase quantity"
        disabled={disabled || atMax}
        onClick={() => onChange(Math.min(cap, value + 1))}
      >
        {useTextControls ? "+" : <Plus size={size === "sm" ? 14 : 16} weight="bold" />}
      </button>
    </div>
  );
}
