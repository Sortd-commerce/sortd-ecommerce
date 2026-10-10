"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { startStripeCheckoutSessionAction } from "@/lib/actions";
import { CheckoutAddressSection } from "@/components/CheckoutAddressSection";
import { CheckoutBasketStep } from "@/components/CheckoutBasketStep";
import { CheckoutPaySheet } from "@/components/CheckoutPaySheet";
import type { CardProduct } from "@/components/catalog";
import { CheckoutMobileHeader, type CheckoutStep } from "@/components/CheckoutMobileHeader";
import { CheckoutProcessingOverlay } from "@/components/CheckoutProcessingOverlay";
import { CheckoutSelectionProvider, useCheckoutSelection } from "@/components/CheckoutSelectionContext";
import { DeliverySlotPicker } from "@/components/DeliverySlotPicker";
import { DirhamIcon } from "@/components/DirhamIcon";
import { OpenBasketLink } from "@/components/OpenBasketLink";
import { OrderSummary } from "@/components/OrderSummary";
import { OptimizedImage } from "@/components/OptimizedImage";
import { useToast } from "@/components/Toast";
import { usePricing } from "@/components/PricingProvider";
import { checkDeliveryPlace } from "@/lib/places";
import { useCart } from "@/components/CartProvider";
import type { CheckoutAddress, CheckoutSlot } from "@/lib/checkout";
import { startRouteLoading } from "@/lib/route-loading";
import { useMobileViewport } from "@/lib/use-mobile-viewport";

export type { CheckoutAddress, CheckoutSlot };

const CHECKOUT_PAYMENT_METHOD = "card";

function slotKey(slot: CheckoutSlot) {
  return `${slot.date}|${slot.window_id}|${slot.source}`;
}

function lineTotal(unitPrice: string, quantity: number) {
  return (Number(unitPrice) * quantity).toFixed(2);
}

function money(value: string | number) {
  const amount = Number(value);
  return Number.isFinite(amount) ? amount.toFixed(2) : "0.00";
}

function firstAvailableSlot(slots: CheckoutSlot[]) {
  return slots.find((row) => row.status === "available" && row.remaining > 0) || null;
}

function slotSummary(slot: CheckoutSlot | null | undefined) {
  if (!slot) return "";
  const parsed = new Date(`${slot.date}T12:00:00`);
  let day = slot.date;
  if (!Number.isNaN(parsed.getTime())) {
    const today = new Date();
    const slotDay = new Date(parsed.getFullYear(), parsed.getMonth(), parsed.getDate());
    const todayDay = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const offset = Math.round((slotDay.getTime() - todayDay.getTime()) / 86_400_000);
    if (offset === 0) day = "Today";
    else if (offset === 1) day = "Tomorrow";
    else day = parsed.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" });
  }
  const start = slot.start_time.slice(0, 5);
  const end = slot.end_time.slice(0, 5);
  const [sh] = start.split(":").map(Number);
  const [eh] = end.split(":").map(Number);
  return `${day}, ${sh % 12 || 12}–${eh % 12 || 12} ${eh >= 12 ? "PM" : "AM"}`;
}

function CheckoutFormInner({
  slots,
  addresses,
}: {
  slots: CheckoutSlot[];
  addresses: CheckoutAddress[];
}) {
  const router = useRouter();
  const toast = useToast();
  const mobile = useMobileViewport();
  const [step, setStep] = useState<CheckoutStep>("basket");
  const { items, count, flush } = useCart();
  const itemsRef = useRef(items);
  const { quote, discountCode } = usePricing();
  const { selectedAddress } = useCheckoutSelection();
  const [slotId, setSlotId] = useState(() => {
    const first = firstAvailableSlot(slots);
    return first ? slotKey(first) : "";
  });
  const [payPending, setPayPending] = useState(false);
  const [upsellProducts, setUpsellProducts] = useState<CardProduct[]>([]);
  const [upsellLoading, setUpsellLoading] = useState(false);
  const upsellRequested = useRef(false);
  const [addressDeliverable, setAddressDeliverable] = useState<boolean | null>(null);
  const formRef = useRef<HTMLFormElement>(null);
  useEffect(() => {
    itemsRef.current = items;
  }, [items]);

  useEffect(() => {
    if (step !== "pay" || upsellRequested.current) return;
    upsellRequested.current = true;
    setUpsellLoading(true);
    let cancelled = false;
    void fetch("/api/storefront/checkout-upsell")
      .then((response) => response.json())
      .then((payload: { ok?: boolean; data?: CardProduct[] }) => {
        if (cancelled || !payload.ok) return;
        setUpsellProducts(payload.data || []);
      })
      .catch(() => {
        upsellRequested.current = false;
      })
      .finally(() => {
        if (!cancelled) setUpsellLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [step]);

  useEffect(() => {
    if (!selectedAddress) {
      setAddressDeliverable(null);
      return;
    }
    let cancelled = false;
    setAddressDeliverable(null);
    void (async () => {
      const result = await checkDeliveryPlace({
        place_id: selectedAddress.place_id || undefined,
        latitude: selectedAddress.latitude || undefined,
        longitude: selectedAddress.longitude || undefined,
        address: selectedAddress.formatted_address || selectedAddress.line1,
      });
      if (cancelled) return;
      const deliverable = Boolean(result.ok && result.data?.serviceable);
      setAddressDeliverable(deliverable);
      if (result.ok && result.data && !result.data.serviceable) {
        toast.error("We do not deliver to this address.");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [selectedAddress, toast]);

  const selectedSlot = useMemo(
    () => slots.find((row) => slotKey(row) === slotId) || firstAvailableSlot(slots),
    [slotId, slots],
  );
  const activeSlot = selectedSlot?.status === "available" ? selectedSlot : firstAvailableSlot(slots);

  const checkoutLocked = payPending;
  const processingMessage = payPending ? "Redirecting to Stripe…" : null;
  const addressOk = addressDeliverable !== false;
  const canPlace = Boolean(selectedAddress && activeSlot && items.length && !checkoutLocked && addressOk);
  const canContinueDelivery = Boolean(selectedAddress && activeSlot && items.length && addressOk);

  async function openStripeCheckout() {
    if (!canPlace || !selectedAddress || !activeSlot) return;
    setPayPending(true);
    const synced = await flush();
    if (!synced.ok) {
      setPayPending(false);
      toast.error(synced.message || "Your basket needs updating before checkout.");
      return;
    }
    const note = formRef.current ? String(new FormData(formRef.current).get("note") || "") : "";
    const result = await startStripeCheckoutSessionAction({
      address_id: selectedAddress.id,
      delivery_date: activeSlot.date,
      window_id: activeSlot.window_id,
      window_source: activeSlot.source,
      payment_method: CHECKOUT_PAYMENT_METHOD,
      discount_code: discountCode.trim() || null,
      expected_total: quote.total,
      note,
    });
    if (!result.ok || !result.url) {
      setPayPending(false);
      toast.error(result.message || "Payment could not be started.");
      return;
    }
    window.location.assign(result.url);
  }

  function onBack() {
    if (step === "pay") setStep("delivery");
    else if (step === "delivery") setStep("basket");
    else {
      startRouteLoading("/");
      router.push("/");
    }
  }

  const addressSection = (
    <section className="checkout-block">
      <CheckoutAddressSection addresses={addresses} />
    </section>
  );

  const slotSection = (
    <section className="checkout-block">
      <p className="step-index">02</p>
      <h2>Delivery slot</h2>
      <DeliverySlotPicker
        slots={slots}
        value={activeSlot ? slotKey(activeSlot) : slotId}
        onChange={setSlotId}
      />
    </section>
  );

  const noteSection = (step: string) => (
    <section className="checkout-block">
      <p className="step-index">{step}</p>
      <h2>Delivery note</h2>
      <label className="field">
        <span className="sr-only">Delivery note</span>
        <textarea
          name="note"
          form="place-order"
          rows={3}
          placeholder={mobile ? "Leave at the door, call on arrival…" : "Gate code, leave at door, call on arrival…"}
        />
      </label>
    </section>
  );

  const orderForm = (
    <form
      id="place-order"
      ref={formRef}
      className="order-card"
      onSubmit={(event) => {
        event.preventDefault();
        void openStripeCheckout();
      }}
    >
      <input type="hidden" name="payment_method" value={CHECKOUT_PAYMENT_METHOD} />
      <div className="order-card-head">
        <h2>Your order</h2>
        <span>
          {count} {count === 1 ? "item" : "items"}
        </span>
      </div>
      <ul className="order-lines">
        {items.map((item) => (
          <li key={item.variant_id}>
            <span className="order-thumb">
              {item.image_url ? (
                <OptimizedImage src={item.image_url} alt="" fill sizes="54px" className="object-cover" />
              ) : (
                <span>{item.title.slice(0, 1)}</span>
              )}
            </span>
            <span>
              <strong>{item.title}</strong>
              <small>
                {item.quantity} × <DirhamIcon /> {item.unit_price}
              </small>
            </span>
            <b><DirhamIcon /> {lineTotal(item.unit_price, item.quantity)}</b>
          </li>
        ))}
        {!items.length ? <li className="order-empty">Your basket is empty.</li> : null}
      </ul>
      <OrderSummary showPromo className="checkout-summary" />
      <button
        type="button"
        className="btn btn-primary checkout-submit"
        disabled={!canPlace}
        onClick={() => void openStripeCheckout()}
      >
        <span>{payPending ? "Redirecting to Stripe…" : "Pay now"}</span>
        <span className="checkout-submit-amount"><DirhamIcon /> {quote.total} <span className="checkout-submit-arrow">→</span></span>
      </button>
      <p className="fine-print checkout-footnote">
        Every item in this order passed all four gates. Lab reports are on each product page.
      </p>
    </form>
  );

  if (mobile) {
    return (
      <div className={`checkout-page checkout-page--mobile${step === "pay" ? " checkout-page--pay" : ""}`}>
        <CheckoutMobileHeader step={step} onBack={onBack} onStepChange={setStep} />
        {step === "basket" ? <CheckoutBasketStep onContinue={() => setStep("delivery")} /> : null}
        {step === "delivery" || step === "pay" ? (
          <div className={`checkout-delivery-stage${step === "pay" ? " checkout-delivery-stage--pay-open" : ""}`}>
            <div className="checkout-mobile-step" aria-hidden={step === "pay"}>
              {addressSection}
              {slotSection}
              {noteSection("03")}
              {step === "delivery" ? (
                <div className="checkout-sticky-foot">
                  <div className="checkout-sticky-foot-row">
                    <div className="checkout-sticky-total" aria-hidden>
                      <small>TO PAY</small>
                      <strong><DirhamIcon /> {money(quote.total)}</strong>
                    </div>
                    <button
                      type="button"
                      className="btn btn-primary checkout-continue-btn"
                      disabled={!canContinueDelivery}
                      aria-label={`Continue to payment, total AED ${money(quote.total)}`}
                      onClick={() => setStep("pay")}
                    >
                      <span className="checkout-continue-copy">
                        Continue to payment
                        <small>
                          {slotSummary(activeSlot)} · {selectedAddress?.is_default ? "Home" : "Address"}
                        </small>
                      </span>
                    </button>
                  </div>
                </div>
              ) : null}
            </div>
            {step === "pay" ? (
              <CheckoutPaySheet
                upsellProducts={upsellProducts}
                upsellLoading={upsellLoading}
                total={quote.total}
                canPlace={canPlace}
                payPending={payPending}
                onPay={() => void openStripeCheckout()}
                onDismiss={() => setStep("delivery")}
              />
            ) : null}
          </div>
        ) : null}
        <form id="place-order" ref={formRef} className="sr-only">
          <textarea name="note" defaultValue="" />
        </form>
        {processingMessage ? <CheckoutProcessingOverlay message={processingMessage} /> : null}
      </div>
    );
  }

  return (
    <div className="checkout-page">
      <div className="checkout-intro">
        <OpenBasketLink className="back-link">Back to basket</OpenBasketLink>
      </div>
      <div className="checkout-layout">
        <div className="checkout-steps-col">
          {addressSection}
          {slotSection}
          {noteSection("03")}
        </div>
        {orderForm}
      </div>
      {processingMessage ? <CheckoutProcessingOverlay message={processingMessage} /> : null}
    </div>
  );
}

export function CheckoutForm(props: { slots: CheckoutSlot[]; addresses: CheckoutAddress[] }) {
  return (
    <CheckoutSelectionProvider>
      <CheckoutFormInner {...props} />
    </CheckoutSelectionProvider>
  );
}
