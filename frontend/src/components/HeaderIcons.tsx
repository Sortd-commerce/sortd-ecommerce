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
