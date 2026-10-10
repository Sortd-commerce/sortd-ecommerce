"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { CaretDownIcon } from "@/components/HeaderIcons";
import { setPrimaryAddressAction } from "@/lib/actions";
import { formatAddressDetails, formatAddressLabel, type DeliveryAddress } from "@/lib/address";

export type DeliverAddress = DeliveryAddress;

function displayLine(address: DeliverAddress) {
  return formatAddressDetails(address);
}

function displayTitle(address: DeliverAddress) {
  return formatAddressLabel(address.label);
}

export function DeliverAddressMenu({ addresses }: { addresses: DeliverAddress[] }) {
  const router = useRouter();
  const rootRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const current = addresses.find((row) => row.is_default) || addresses[0];

  useEffect(() => {
    function onPointer(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    window.addEventListener("mousedown", onPointer);
    return () => window.removeEventListener("mousedown", onPointer);
  }, []);

  function choose(id: number) {
    startTransition(async () => {
      await setPrimaryAddressAction(id);
      router.refresh();
      setOpen(false);
    });
  }

  if (!current) return null;

  return (
    <div className="deliver-address-menu" ref={rootRef}>
      <button
        type="button"
        className="deliver-place"
        aria-expanded={open}
        aria-haspopup="listbox"
        disabled={pending}
        onClick={() => setOpen((value) => !value)}
      >
        <span className="deliver-place-full">{`${displayTitle(current)} · ${displayLine(current)}`}</span>
        <CaretDownIcon />
      </button>
      {open ? (
        <ul className="deliver-address-dropdown" role="listbox" aria-label="Delivery addresses">
          {addresses.map((row) => (
            <li key={row.id} role="option" aria-selected={row.id === current.id}>
              <button type="button" className="deliver-address-option" onClick={() => choose(row.id)}>
                {`${displayTitle(row)} · ${displayLine(row)}`}
              </button>
            </li>
          ))}
          <li className="deliver-address-dropdown-foot">
            <Link href="/checkout" className="deliver-address-link" onClick={() => setOpen(false)}>
              Change at checkout
            </Link>
            <Link href="/addresses" className="deliver-address-link" onClick={() => setOpen(false)}>
              Manage addresses
            </Link>
          </li>
        </ul>
      ) : null}
    </div>
  );
}
