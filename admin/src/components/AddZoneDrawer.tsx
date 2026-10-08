"use client";

import { useEffect, useState } from "react";
import { X } from "@phosphor-icons/react";
import { CreateZoneForm } from "@/components/CreateZoneForm";

export function AddZoneDrawer() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = previous;
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <>
      <button type="button" className="btn" onClick={() => setOpen(true)}>
        Add delivery zone
      </button>
      {open ? (
        <div className="drawer-layer">
          <button type="button" className="drawer-scrim" aria-label="Close add zone panel" onClick={() => setOpen(false)} />
          <aside
            className="drawer-panel drawer-panel--wide drawer-panel--enter"
            role="dialog"
            aria-modal="true"
            aria-label="Add delivery zone"
          >
            <div className="drawer-head">
              <div>
                <h2 className="text-lg font-semibold">Add delivery zone</h2>
                <p className="mt-1 text-sm text-muted">Draw a boundary on the map. Checkout uses the global delivery fee.</p>
              </div>
              <button type="button" className="drawer-close" aria-label="Close" onClick={() => setOpen(false)}>
                <X size={18} weight="bold" />
              </button>
            </div>
            <div className="drawer-body">
              <CreateZoneForm onSuccess={() => setOpen(false)} />
            </div>
          </aside>
        </div>
      ) : null}
    </>
  );
}
