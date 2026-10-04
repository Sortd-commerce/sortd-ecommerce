"use client";

import { useEffect, useId, useRef, useState, useTransition } from "react";
import { ActionForm, SubmitButton } from "@/components/ActionForm";
import { saveAddressAction } from "@/lib/actions";
import {
  autocompletePlaces,
  checkDeliveryPlace,
  type DeliveryCheck,
  type PlaceSuggestion,
} from "@/lib/places";

type SelectedPlace = {
  place_id: string;
  label: string;
  latitude: string;
  longitude: string;
  postal_code: string;
  formatted_address: string;
  serviceable: boolean;
};

function toSelected(check: DeliveryCheck, fallbackLabel = ""): SelectedPlace {
  return {
    place_id: check.place_id || "",
    label: check.formatted_address || fallbackLabel,
    latitude: check.latitude || "",
    longitude: check.longitude || "",
    postal_code: check.postal_code || "",
    formatted_address: check.formatted_address || fallbackLabel,
    serviceable: Boolean(check.serviceable),
  };
}

export function AddressPicker() {
  const listId = useId();
  const [query, setQuery] = useState("");
  const [suggestions, setSuggestions] = useState<PlaceSuggestion[]>([]);
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<SelectedPlace | null>(null);
  const [message, setMessage] = useState("");
  const [locating, setLocating] = useState(false);
  const [pending, startTransition] = useTransition();
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    const value = query.trim();
    if (value.length < 2) {
      setSuggestions([]);
      return;
    }
    debounceRef.current = setTimeout(() => {
      startTransition(async () => {
        const rows = await autocompletePlaces(value);
        setSuggestions(rows);
        setOpen(true);
      });
    }, 280);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query]);

  function applyCheck(result: { ok: boolean; message: string; data?: DeliveryCheck }, fallbackLabel = "") {
    if (!result.ok || !result.data) {
      setSelected(null);
      setMessage(result.message || "Could not verify that address.");
      return;
    }
    const next = toSelected(result.data, fallbackLabel);
    setSelected(next);
    setQuery(next.formatted_address || fallbackLabel);
    setOpen(false);
    setSuggestions([]);
    setMessage(
      next.serviceable
        ? "We deliver to this address."
        : "We do not deliver to this address yet.",
    );
  }

  function onPick(suggestion: PlaceSuggestion) {
    startTransition(async () => {
      const result = await checkDeliveryPlace({
        place_id: suggestion.place_id,
        latitude: suggestion.latitude || undefined,
        longitude: suggestion.longitude || undefined,
      });
      applyCheck(result, suggestion.label);
    });
  }

  function useMyLocation() {
    if (!navigator.geolocation) {
      setMessage("Location is not available in this browser.");
      return;
    }
    setLocating(true);
    setMessage("Getting your location…");
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const latitude = String(position.coords.latitude);
        const longitude = String(position.coords.longitude);
        startTransition(async () => {
          const result = await checkDeliveryPlace({ latitude, longitude });
          applyCheck(result);
          setLocating(false);
        });
      },
      () => {
        setLocating(false);
        setMessage("Could not access your location. Check browser permissions.");
      },
      { enableHighAccuracy: true, timeout: 12000 },
    );
  }

  const canSave = Boolean(selected?.serviceable);

  return (
    <div className="mt-4 grid gap-3">
      <label className="field">
        <span>Search address</span>
        <input
          value={query}
          onChange={(event) => {
            setQuery(event.target.value);
            setSelected(null);
            setMessage("");
          }}
          onFocus={() => suggestions.length && setOpen(true)}
          placeholder="Start typing an address in the UAE"
          autoComplete="off"
          role="combobox"
          aria-expanded={open}
          aria-controls={listId}
          aria-autocomplete="list"
        />
      </label>

      {open && suggestions.length ? (
        <ul
          id={listId}
          role="listbox"
          className="max-h-56 overflow-auto rounded-xl border border-line bg-paper p-1 text-sm"
        >
          {suggestions.map((item) => (
            <li key={item.place_id}>
              <button
                type="button"
                role="option"
                className="w-full rounded-lg px-3 py-2 text-left hover:bg-sand"
                onClick={() => onPick(item)}
              >
                {item.label}
              </button>
            </li>
          ))}
        </ul>
      ) : null}

      <div className="flex flex-wrap gap-2">
        <button type="button" className="btn btn-secondary" onClick={useMyLocation} disabled={locating || pending}>
          {locating ? "Locating…" : "Use my location"}
        </button>
        {pending ? <span className="self-center text-sm text-ink/55">Checking…</span> : null}
      </div>

      {message ? (
        <p
          className={`text-sm ${selected?.serviceable ? "text-leaf" : "text-citrus"}`}
          role="status"
          aria-live="polite"
        >
          {message}
        </p>
      ) : null}

      <ActionForm action={saveAddressAction} className="grid gap-3">
        <input type="hidden" name="place_id" value={selected?.place_id || ""} />
        <input type="hidden" name="formatted_address" value={selected?.formatted_address || ""} />
        <input type="hidden" name="latitude" value={selected?.latitude || ""} />
        <input type="hidden" name="longitude" value={selected?.longitude || ""} />
        <input type="hidden" name="postal_code" value={selected?.postal_code || ""} />
        <input type="hidden" name="line1" value={selected?.formatted_address || query} />
        <input type="hidden" name="city" value="Dubai" />
        <SubmitButton className="btn btn-secondary" disabled={!canSave}>
          Save address
        </SubmitButton>
      </ActionForm>
    </div>
  );
}
