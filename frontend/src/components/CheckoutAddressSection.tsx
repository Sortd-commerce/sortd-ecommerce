"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { PencilSimple, ArrowsLeftRight } from "@phosphor-icons/react";
import type { CheckoutAddress } from "@/lib/checkout";
import { AddressPicker } from "@/components/AddressPicker";
import { useToast } from "@/components/Toast";
import { useCheckoutSelection } from "@/components/CheckoutSelectionContext";
import { setPrimaryAddressAction } from "@/lib/actions";
import { formatAddressDetails, formatAddressLabel } from "@/lib/address";

function addressTitle(address: CheckoutAddress) {
  return formatAddressLabel(address.label);
}

function addressDetail(address: CheckoutAddress) {
  return formatAddressDetails(address);
}

function ChoiceCard({
  name,
  value,
  checked,
  disabled,
  title,
  detail,
  onChange,
}: {
  name: string;
  value: string;
  checked: boolean;
  disabled?: boolean;
  title: string;
  detail?: string;
  onChange: () => void;
}) {
  return (
    <label
      className={`pick-card ${checked ? "pick-card-on" : ""} ${disabled ? "is-disabled" : ""}`}
      onClick={() => {
        if (!disabled) onChange();
      }}
    >
      <input
        type="radio"
        name={name}
        value={value}
        checked={checked}
        disabled={disabled}
        readOnly
        tabIndex={-1}
        aria-hidden="true"
      />
      <span>
        <strong>{title}</strong>
        {detail ? <small>{detail}</small> : null}
      </span>
    </label>
  );
}

export function CheckoutAddressSection({ addresses }: { addresses: CheckoutAddress[] }) {
  const router = useRouter();
  const toast = useToast();
  const { selectedAddress: contextAddress, setSelectedAddress } = useCheckoutSelection();
  const [settingPrimary, startPrimary] = useTransition();
  const defaultAddress = addresses.find((row) => row.is_default) || addresses[0];
  const [addressId, setAddressId] = useState<number | "">(defaultAddress?.id || "");
  const [panel, setPanel] = useState<"pick" | "add" | "edit">(addresses.length ? "pick" : "add");
  const [addressOpen, setAddressOpen] = useState(false);

  const selectedAddress = useMemo(
    () => addresses.find((row) => row.id === addressId) || defaultAddress || contextAddress || null,
    [addressId, addresses, contextAddress, defaultAddress],
  );

  useEffect(() => {
    setSelectedAddress(selectedAddress);
  }, [setSelectedAddress, selectedAddress]);

  useEffect(() => {
    if (!addresses.length) {
      setPanel("add");
      return;
    }
    if (!addresses.some((row) => row.id === addressId)) {
      setAddressId(defaultAddress?.id || addresses[0].id);
    }
  }, [addresses, addressId, defaultAddress]);

  function onAddressSaved() {
    setPanel("pick");
    setAddressOpen(false);
    router.refresh();
  }

  function makePrimary(address: CheckoutAddress) {
    startPrimary(async () => {
      const result = await setPrimaryAddressAction(address.id);
      if (result.ok) {
        toast.success(result.message);
        setAddressId(address.id);
        router.refresh();
      } else {
        toast.error(result.message);
      }
    });
  }

  function cancelAddressFlow() {
    if (addressOpen) {
      setAddressOpen(false);
      return;
    }
    setPanel("pick");
  }

  const showCancel = (panel === "add" && addresses.length > 0) || addressOpen || panel === "edit";

  if (panel === "add") {
    return (
      <>
        <div className="checkout-block-head">
          <div className="checkout-block-title">
            <p className="step-index">01</p>
            <h2>Deliver to</h2>
          </div>
          {showCancel ? (
            <button type="button" className="checkout-cancel" onClick={cancelAddressFlow}>
              Cancel
            </button>
          ) : null}
        </div>
        <p className="fine-print">We deliver across Dubai. Search for your building or use your location.</p>
        <AddressPicker
          isDefault={addresses.length === 0}
          showPrimaryToggle={addresses.length > 0}
          submitLabel={addresses.length === 0 ? "Save primary address" : "Save address"}
          onSaved={onAddressSaved}
        />
      </>
    );
  }

  if (panel === "edit" && selectedAddress) {
    return (
      <>
        <div className="checkout-block-head">
          <div className="checkout-block-title">
            <p className="step-index">01</p>
            <h2>Deliver to</h2>
          </div>
          <button type="button" className="checkout-cancel" onClick={cancelAddressFlow}>
            Cancel
          </button>
        </div>
        <AddressPicker
          key={selectedAddress.id}
          addressId={selectedAddress.id}
          isDefault={Boolean(selectedAddress.is_default)}
          showPrimaryToggle
          submitLabel="Update address"
          initialQuery={selectedAddress.formatted_address || selectedAddress.line1}
          initialPlace={{
            place_id: selectedAddress.place_id,
            latitude: selectedAddress.latitude,
            longitude: selectedAddress.longitude,
            postal_code: selectedAddress.postal_code,
            formatted_address: selectedAddress.formatted_address || selectedAddress.line1,
          }}
          initialDetails={{
            label: selectedAddress.label,
            community: selectedAddress.community,
            building: selectedAddress.building,
            unit: selectedAddress.unit,
            floor: selectedAddress.floor,
          }}
          onSaved={onAddressSaved}
        />
      </>
    );
  }

  return (
    <>
      <div className="checkout-block-head">
        <div className="checkout-block-title">
          <p className="step-index">01</p>
          <h2>Deliver to</h2>
        </div>
        {showCancel ? (
          <button type="button" className="checkout-cancel" onClick={cancelAddressFlow}>
            Cancel
          </button>
        ) : null}
      </div>
      {panel === "pick" && !addressOpen && selectedAddress ? (
        <div className="pick-card pick-card-on address-summary">
          <input type="radio" checked readOnly tabIndex={-1} aria-label="Selected address" />
          <span>
            <strong>{addressTitle(selectedAddress)}</strong>
            <small>{addressDetail(selectedAddress)}</small>
          </span>
          <span className="address-summary-actions">
            <button
              type="button"
              className="addr-icon-btn addr-icon-btn--edit"
              onClick={() => setPanel("edit")}
              title="Edit address"
              aria-label="Edit address"
            >
              <PencilSimple size={15} weight="bold" />
              <span>Edit</span>
            </button>
            <button
              type="button"
              className="addr-icon-btn addr-icon-btn--change"
              onClick={() => setAddressOpen(true)}
              title="Change address"
              aria-label="Change address"
            >
              <ArrowsLeftRight size={15} weight="bold" />
              <span>Change</span>
            </button>
          </span>
        </div>
      ) : null}
      {panel === "pick" && addressOpen ? (
        <div className="choice-stack address-picker-list" role="radiogroup" aria-label="Saved addresses">
          {addresses.map((address) => (
            <ChoiceCard
              key={address.id}
              name="saved_address"
              value={String(address.id)}
              checked={address.id === selectedAddress?.id}
              title={addressTitle(address)}
              detail={addressDetail(address)}
              onChange={() => {
                setAddressId(address.id);
                setAddressOpen(false);
              }}
            />
          ))}
        </div>
      ) : null}
      {panel === "pick" && selectedAddress && !selectedAddress.is_default && !addressOpen ? (
        <button
          type="button"
          className="text-action"
          disabled={settingPrimary}
          onClick={() => makePrimary(selectedAddress)}
        >
          Set as primary delivery address
        </button>
      ) : null}
      {panel === "pick" && !addressOpen ? (
        <button
          type="button"
          className="text-action add-address"
          onClick={() => {
            setAddressOpen(false);
            setPanel("add");
          }}
        >
          + Add a new address
        </button>
      ) : null}
      {panel === "pick" && !addressOpen ? (
        <p className="fine-print">We deliver across Dubai. Search for your building or use your location.</p>
      ) : null}
    </>
  );
}

export function CheckoutAddressSkeleton() {
  return (
    <>
      <div className="pick-card address-summary page-loading" aria-hidden>
        <span className="skeleton skeleton--line" />
        <span className="skeleton skeleton--line skeleton--line-short" />
      </div>
      <p className="fine-print">Loading saved addresses…</p>
    </>
  );
}
