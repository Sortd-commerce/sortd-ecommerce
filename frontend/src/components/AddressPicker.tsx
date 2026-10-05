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

export function AddressPicker({
  addressId,
  isDefault = true,
  submitLabel = "Save address",
  initialQuery = "",
  initialPlace,
  onSaved,
}: {
  addressId?: number;
  isDefault?: boolean;
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
  const [selected, setSelected] = useState<SelectedPlace | null>(() => {
    if (!initialPlace?.place_id && !initialPlace?.latitude) return null;
    return {
      place_id: initialPlace.place_id || "",
      label: initialPlace.formatted_address || initialQuery || "",
      latitude: initialPlace.latitude || "",
      longitude: initialPlace.longitude || "",
      postal_code: initialPlace.postal_code || "",
      formatted_address: initialPlace.formatted_address || initialQuery || "",
      serviceable: true,
    };
  });
  const [locating, setLocating] = useState(false);
  const [pending, startTransition] = useTransition();
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const skipSuggest = useRef(Boolean(initialPlace || initialQuery));

  const [state, formAction] = useActionState(async (prev: ActionState, formData: FormData) => {
    if (!selected) {
      toast.error("Pick an address from the suggestions, or use your location.");
      return prev;
    }
    if (!selected.serviceable) {
      toast.error("We do not deliver to that address yet.");
      return prev;
    }
    return saveAddressAction(prev, formData);
  }, emptyActionState);

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
      toast.success("We deliver to this address.");
    } else {
      toast.error("We do not deliver to this address yet.");
    }
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
      toast.error("Location is not available in this browser.");
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
        toast.error("Could not access your location. Check browser permissions.");
      },
      { enableHighAccuracy: true, timeout: 12000 },
    );
  }

  const canSave = Boolean(selected?.serviceable);
  const validity =
    selected?.serviceable === true ? "valid" : selected && !selected.serviceable ? "invalid" : query.trim() && !selected ? "pending" : "";

  return (
    <div className="mt-4 grid gap-3">
      <label className="field">
        <span>Search address</span>
        <span className="relative block">
          <input
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              setSelected(null);
            }}
            onFocus={() => suggestions.length && setOpen(true)}
            placeholder="Search any city to test pin codes"
            autoComplete="off"
            role="combobox"
            aria-expanded={open}
            aria-controls={listId}
            aria-autocomplete="list"
            aria-invalid={validity === "invalid" || undefined}
            className={`pr-12 ${validity === "valid" ? "field-valid" : validity === "invalid" ? "field-invalid" : ""}`}
          />
          <button
            type="button"
            className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg p-1.5 text-forest transition hover:bg-sand disabled:opacity-50"
            onClick={useMyLocation}
            disabled={locating || pending}
            aria-label={locating ? "Locating" : "Use my location"}
            title="Use my location"
          >
            {locating || pending ? <SpinnerGap size={20} className="animate-spin" /> : <Crosshair size={20} weight="bold" />}
          </button>
        </span>
        {validity === "valid" ? (
          <p className="text-sm font-medium text-leaf">Deliverable address confirmed.</p>
        ) : null}
        {validity === "invalid" ? (
          <p className="text-sm font-medium text-citrus">We do not deliver to this address yet.</p>
        ) : null}
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

      <form action={formAction} className="grid gap-3">
        {addressId ? <input type="hidden" name="address_id" value={addressId} /> : null}
        <input type="hidden" name="is_default" value={isDefault ? "true" : "false"} />
        <input type="hidden" name="place_id" value={selected?.place_id || ""} />
        <input type="hidden" name="formatted_address" value={selected?.formatted_address || ""} />
        <input type="hidden" name="latitude" value={selected?.latitude || ""} />
        <input type="hidden" name="longitude" value={selected?.longitude || ""} />
        <input type="hidden" name="postal_code" value={selected?.postal_code || ""} />
        <input type="hidden" name="line1" value={selected?.formatted_address || query} />
        <input type="hidden" name="city" value="Dubai" />
        <SubmitButton className="btn btn-secondary" disabled={!canSave} pendingLabel="Saving…">
          {submitLabel}
        </SubmitButton>
        {!selected && query.trim() ? (
          <p className="text-sm text-ink/55">Choose a suggestion from the list to confirm the place.</p>
        ) : null}
      </form>
    </div>
  );
}
