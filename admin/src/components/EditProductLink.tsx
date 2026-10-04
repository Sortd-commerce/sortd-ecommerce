"use client";

import Link from "next/link";
import { PencilSimple } from "@phosphor-icons/react";

export function EditProductLink({ href, title }: { href: string; title: string }) {
  return (
    <Link
      href={href}
      className="inline-flex rounded-lg p-2 text-muted hover:bg-panel-2 hover:text-accent focus-visible:ring-2 focus-visible:ring-accent"
      aria-label={`Edit ${title}`}
    >
      <PencilSimple size={18} aria-hidden="true" />
    </Link>
  );
}
