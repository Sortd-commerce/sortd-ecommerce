"use client";

import { Crosshair, SpinnerGap } from "@phosphor-icons/react";
import { useActionState, useEffect, useId, useRef, useState, useTransition } from "react";
import { SubmitButton, emptyActionState } from "@/components/ActionForm";
import { useToast } from "@/components/Toast";
import type { ActionState } from "@/lib/action-state";
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
  zone_name: string;
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
    zone_name: check.zone_name || "",
  };
}

export function AddressPicker({
  addressId,
  isDefault = true,
  showPrimaryToggle = false,
  submitLabel = "Save address",
  initialQuery = "",
  initialPlace,
  onSaved,
}: {
  addressId?: number;
  isDefault?: boolean;
  showPrimaryToggle?: boolean;
  submitLabel?: string;
  initialQuery?: string;
  initialPlace?: {
    place_id?: string;
    latitude?: string | null;
    longitude?: string | null;
    postal_code?: string;
    formatted_address?: string;
  };
  onSaved?: () => void;
}) {
  const toast = useToast();
  const listId = useId();
  const [query, setQuery] = useState(initialQuery || initialPlace?.formatted_address || "");
  const [suggestions, setSuggestions] = useState<PlaceSuggestion[]>([]);
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<SelectedPlace | null>(null);
  const [locating, setLocating] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [makePrimary, setMakePrimary] = useState(isDefault);
  const [pending, startTransition] = useTransition();
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const skipSuggest = useRef(Boolean(initialPlace || initialQuery));
  const rootRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const [state, formAction] = useActionState(async (prev: ActionState, formData: FormData) => {
    if (!selected) {
      toast.error("Select an address from the list, or use your location.");
      return prev;
    }
    if (!selected.serviceable) {
      toast.error("We do not deliver to that address yet.");
      return prev;
    }
    return saveAddressAction(prev, formData);
  }, emptyActionState);

  useEffect(() => {
    if (!initialPlace?.place_id && !initialPlace?.latitude) return;
    let cancelled = false;
    void (async () => {
      const result = await checkDeliveryPlace({
        place_id: initialPlace.place_id || undefined,
        latitude: initialPlace.latitude || undefined,
        longitude: initialPlace.longitude || undefined,
        address: initialPlace.formatted_address || initialQuery,
      });
      if (cancelled) return;
      if (result.ok && result.data) {
        setSelected(toSelected(result.data, initialPlace.formatted_address || initialQuery || ""));
        skipSuggest.current = true;
        setQuery(result.data.formatted_address || initialPlace.formatted_address || initialQuery || "");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [addressId, initialPlace, initialQuery]);

  useEffect(() => {
    if (!state.message) return;
    if (state.ok) {
      toast.success(state.message);
      onSaved?.();
    } else {
      toast.error(state.message);
    }
  }, [state, toast, onSaved]);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (skipSuggest.current) {
      skipSuggest.current = false;
      return;
    }
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

  useEffect(() => {
    function onPointer(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    window.addEventListener("mousedown", onPointer);
    return () => window.removeEventListener("mousedown", onPointer);
  }, []);

  function applyCheck(result: { ok: boolean; message: string; data?: DeliveryCheck }, fallbackLabel = "") {
    if (!result.ok || !result.data) {
      setSelected(null);
      toast.error(result.message || "Could not verify that address.");
      return;
    }
    const next = toSelected(result.data, fallbackLabel);
    setSelected(next);
    skipSuggest.current = true;
    setQuery(next.formatted_address || fallbackLabel);
    setOpen(false);
    setSuggestions([]);
    if (next.serviceable) {
      toast.success(next.zone_name ? `We deliver to ${next.zone_name}.` : "We deliver to this address.");
    } else {
      toast.error("We do not deliver to this address yet.");
    }
  }

  async function onPick(suggestion: PlaceSuggestion) {
    setOpen(false);
    setSuggestions([]);
    setVerifying(true);
    try {
      const result = await checkDeliveryPlace({
        place_id: suggestion.place_id,
        latitude: suggestion.latitude || undefined,
        longitude: suggestion.longitude || undefined,
        address: suggestion.label,
      });
      applyCheck(result, suggestion.label);
    } catch {
      setSelected(null);
      toast.error("Could not verify that address.");
    } finally {
      setVerifying(false);
    }
  }

  function useMyLocation() {
    if (!navigator.geolocation) {
      toast.error("Location is not available on this device.");
      return;
    }
    setLocating(true);
    toast.info("Getting your location…");
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
        toast.error("Could not access your location.");
      },
      { enableHighAccuracy: true, timeout: 12000 },
    );
  }

  const canSave = Boolean(selected?.serviceable);
  const validity =
    selected?.serviceable === true ? "valid" : selected && !selected.serviceable ? "invalid" : query.trim() && !selected ? "pending" : "";

  return (
    <div className="mt-4 grid gap-3" ref={rootRef}>
      <label className="field">
        <span>Search address</span>
        <span className="address-search-wrap relative block">
          <input
            ref={inputRef}
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              setSelected(null);
            }}
            onFocus={() => suggestions.length && setOpen(true)}
            onKeyDown={(event) => {
              if (event.key === "Escape") {
                setOpen(false);
                return;
              }
              if (event.key === "Enter" && open && suggestions[0]) {
                event.preventDefault();
                void onPick(suggestions[0]);
              }
            }}
            placeholder="Search for your building or area"
            autoComplete="off"
            role="combobox"
            aria-expanded={open}
            aria-controls={listId}
            aria-autocomplete="list"
            aria-invalid={validity === "invalid" || undefined}
            aria-busy={verifying || undefined}
            className={`pr-12 ${validity === "valid" ? "field-valid" : validity === "invalid" ? "field-invalid" : ""}`}
          />
          <button
            type="button"
            className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg p-1.5 text-forest transition hover:bg-sand disabled:opacity-50"
            onClick={useMyLocation}
            disabled={locating || pending || verifying}
            aria-label={locating ? "Locating" : "Use my location"}
            title="Use my location"
          >
            {locating || pending || verifying ? (
              <SpinnerGap size={20} className="animate-spin" />
            ) : (
              <Crosshair size={20} weight="bold" />
            )}
          </button>
          {open && suggestions.length ? (
            <ul
              id={listId}
              role="listbox"
              className="address-suggestions max-h-56 overflow-auto rounded-xl border border-line bg-paper p-1 text-sm shadow-lg"
              onTouchStart={() => inputRef.current?.focus({ preventScroll: true })}
              onWheel={() => inputRef.current?.focus({ preventScroll: true })}
            >
              {suggestions.map((item) => (
                <li key={item.place_id}>
                  <button
                    type="button"
                    role="option"
                    className="w-full rounded-lg px-3 py-2 text-left hover:bg-sand focus-visible:bg-sand"
                    onPointerDown={(event) => {
                      event.preventDefault();
                      void onPick(item);
                    }}
                  >
                    {item.label}
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
        </span>
        {validity === "valid" ? (
          <p className="text-sm font-medium text-leaf">We deliver to this address.</p>
        ) : null}
        {validity === "invalid" ? (
          <p className="text-sm font-medium text-citrus">We do not deliver to this address yet.</p>
        ) : null}
        {verifying ? <p className="text-sm text-ink/55">Checking delivery area…</p> : null}
      </label>

      <form action={formAction} className="grid gap-3">
        {addressId ? <input type="hidden" name="address_id" value={addressId} /> : null}
        {showPrimaryToggle || addressId ? (
          <label className="field-check">
            <input
              type="checkbox"
              checked={makePrimary}
              onChange={(event) => setMakePrimary(event.target.checked)}
            />
            <span>Use as my primary delivery address</span>
          </label>
        ) : null}
        <input type="hidden" name="is_default" value={showPrimaryToggle || addressId ? (makePrimary ? "true" : "false") : "true"} />
        <input type="hidden" name="place_id" value={selected?.place_id || ""} />
        <input type="hidden" name="formatted_address" value={selected?.formatted_address || ""} />
        <input type="hidden" name="latitude" value={selected?.latitude || ""} />
        <input type="hidden" name="longitude" value={selected?.longitude || ""} />
        <input type="hidden" name="postal_code" value={selected?.postal_code || ""} />
        <input type="hidden" name="line1" value={selected?.formatted_address || query} />
        <input type="hidden" name="city" value="Dubai" />
        <SubmitButton className="btn btn-secondary" disabled={!canSave || verifying} pendingLabel="Saving…">
          {submitLabel}
        </SubmitButton>
        {!selected && query.trim() && !verifying ? (
          <p className="text-sm text-ink/55">Select an address from the list.</p>
        ) : null}
      </form>
    </div>
  );
}
