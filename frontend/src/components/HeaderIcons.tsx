"use client";

import { CaretDown, MapPin, User } from "@phosphor-icons/react";

export function DeliverPinIcon() {
  return <MapPin size={14} weight="fill" className="header-glyph deliver-pin" aria-hidden />;
}

export function CaretDownIcon() {
  return <CaretDown size={10} weight="bold" className="header-glyph deliver-caret" aria-hidden />;
}

export function AccountIcon() {
  return <User size={18} weight="regular" className="header-glyph" aria-hidden />;
}

export function BasketClockIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 16 16"
      fill="none"
      className="basket-deliver-clock"
      aria-hidden
    >
      <circle cx="8" cy="8" r="6.25" stroke="currentColor" strokeWidth="1.5" />
      <path
        d="M8 4.75V8l2.25 1.125"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
