"use client";

import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { useActionState, useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ActionState } from "@/lib/action-state";
import {
  placeOrderAction,
  placePaidOrderAction,
  prepareStripePaymentAction,
  validateCheckoutAction,
} from "@/lib/actions";
import { emptyActionState, SubmitButton } from "@/components/ActionForm";
import { CheckoutAddressSection } from "@/components/CheckoutAddressSection";
import { CheckoutCodPendingOverlay } from "@/components/CheckoutCodPendingOverlay";
import { CheckoutProcessingOverlay } from "@/components/CheckoutProcessingOverlay";
import { CheckoutSelectionProvider } from "@/components/CheckoutSelectionContext";
import { DeliverySlotPicker } from "@/components/DeliverySlotPicker";
import { OpenBasketLink } from "@/components/OpenBasketLink";
import { OrderSummary } from "@/components/OrderSummary";
import { OptimizedImage } from "@/components/OptimizedImage";
import { useToast } from "@/components/Toast";
import { usePricing } from "@/components/PricingProvider";
import { useCart } from "@/components/CartProvider";
import { useStripeWalletSupport } from "@/components/useStripeWalletSupport";
import type { CheckoutAddress, CheckoutPaymentMethod, CheckoutSlot } from "@/lib/checkout";
import { toSyncPayload } from "@/lib/cart-store";

const CheckoutPaymentModal = dynamic(
  () => import("@/components/CheckoutPaymentModal").then((mod) => mod.CheckoutPaymentModal),
  { ssr: false },
);

export type { CheckoutAddress, CheckoutPaymentMethod, CheckoutSlot };

function slotKey(slot: CheckoutSlot) {
  return `${slot.date}|${slot.window_id}|${slot.source}`;
}

function lineTotal(unitPrice: string, quantity: number) {
  return (Number(unitPrice) * quantity).toFixed(2);
}

const CHECKOUT_PAYMENT_ORDER = ["apple_pay", "card", "cod"] as const;

const PAYMENT_NAME: Record<string, string> = {
  apple_pay: "Apple Pay",
  cod: "Cash on delivery",
  card: "Credit or debit card",
};

const PAYMENT_DETAIL: Record<string, string> = {
  apple_pay: "Pay with Face ID",
  cod: "Pay the rider at your door",
  card: "Visa, Mastercard, Amex",
};

function checkoutPaymentMethods(methods: CheckoutPaymentMethod[]) {
  const allowed = new Set<string>(CHECKOUT_PAYMENT_ORDER);
  const rows = methods.filter((row) => allowed.has(row.code));
  return CHECKOUT_PAYMENT_ORDER.map((code) => rows.find((row) => row.code === code)).filter(
    (row): row is CheckoutPaymentMethod => Boolean(row),
  );
}

function usesStripePayment(code: string) {
  return code === "apple_pay" || code === "card";
}

function initialPaymentMethod(methods: CheckoutPaymentMethod[]) {
  const active = checkoutPaymentMethods(methods).filter((row) => row.is_active);
  return active.find((row) => row.code === "card")?.code || active.find((row) => row.code !== "apple_pay")?.code || active[0]?.code || "";
}

function firstAvailableSlot(slots: CheckoutSlot[]) {
  return slots.find((row) => row.status === "available" && row.remaining > 0) || null;
}

function isPaymentSelectable(
  method: CheckoutPaymentMethod,
  walletSupport: { applePay: boolean; loading: boolean },
) {
  if (!method.is_active) return false;
  if (method.code === "apple_pay") return walletSupport.applePay && !walletSupport.loading;
  return true;
}

function paymentMethodDetail(
  method: CheckoutPaymentMethod,
  walletSupport: { applePay: boolean; loading: boolean },
) {
  if (!method.is_active) return "Unavailable";
  if (method.code === "apple_pay" && !walletSupport.loading && !walletSupport.applePay) {
    return "Use Safari on iPhone, iPad, or Mac";
  }
  return PAYMENT_DETAIL[method.code];
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

export function CheckoutForm({
  slots,
  paymentMethods,
  addresses,
}: {
  slots: CheckoutSlot[];
  paymentMethods: CheckoutPaymentMethod[];
  addresses: CheckoutAddress[];
}) {
  const router = useRouter();
  const toast = useToast();
  const { items, count, flush } = useCart();
  const itemsRef = useRef(items);
  const { quote, discountCode, syncQuote } = usePricing();
  const [selectedAddress, setSelectedAddress] = useState<CheckoutAddress | null>(null);
  const onAddressChange = useCallback((address: CheckoutAddress | null) => {
    setSelectedAddress(address);
  }, []);
  const walletSupport = useStripeWalletSupport(quote.total);
  const checkoutPayments = useMemo(() => checkoutPaymentMethods(paymentMethods), [paymentMethods]);
  const selectablePayments = useMemo(
    () => checkoutPayments.filter((row) => isPaymentSelectable(row, walletSupport)),
    [checkoutPayments, walletSupport],
  );
  const applePayConfigured = checkoutPayments.some((row) => row.code === "apple_pay" && row.is_active);
  const showApplePayUnavailable =
    applePayConfigured && !walletSupport.loading && !walletSupport.applePay;
  const [slotId, setSlotId] = useState(() => {
    const first = firstAvailableSlot(slots);
    return first ? slotKey(first) : "";
  });
  const [paymentMethod, setPaymentMethod] = useState(() => initialPaymentMethod(paymentMethods));
  const paymentTouchedRef = useRef(false);
  const [payModal, setPayModal] = useState<{
    clientSecret: string;
    preferWallet: "apple_pay" | "card";
    total: string;
  } | null>(null);
  const [payPending, setPayPending] = useState(false);
  const [payProcessing, setPayProcessing] = useState(false);
  const [placingOrder, setPlacingOrder] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);
  const toastedRef = useRef("");

  useEffect(() => {
    itemsRef.current = items;
  }, [items]);

  const selectedSlot = useMemo(
    () => slots.find((row) => slotKey(row) === slotId) || firstAvailableSlot(slots),
    [slotId, slots],
  );
  const activeSlot = selectedSlot?.status === "available" ? selectedSlot : firstAvailableSlot(slots);

  async function prepareCheckout(
    payload: {
      address_id: number;
      delivery_date: string;
      window_id: number;
      window_source: string;
      payment_method: string;
      discount_code: string;
    },
  ) {
    const synced = await flush();
    if (!synced.ok) {
      return { ok: false as const, message: synced.message || "Your basket needs updating before checkout." };
    }
    const validated = await validateCheckoutAction({
      address_id: payload.address_id,
      delivery_date: payload.delivery_date,
      window_id: payload.window_id,
      window_source: payload.window_source,
      payment_method: payload.payment_method,
      discount_code: payload.discount_code || null,
    });
    if (!validated.ok || !validated.data) {
      return { ok: false as const, message: validated.message || "Checkout could not be completed." };
    }
    syncQuote(validated.data);
    return { ok: true as const, total: validated.data.total };
  }

  const [state, formAction] = useActionState(async (prev: ActionState, formData: FormData) => {
    const prepared = await prepareCheckout({
      address_id: Number(formData.get("address_id")),
      delivery_date: String(formData.get("delivery_date") || ""),
      window_id: Number(formData.get("window_id")),
      window_source: String(formData.get("window_source") || "weekly"),
      payment_method: String(formData.get("payment_method") || ""),
      discount_code: String(formData.get("discount_code") || discountCode.trim()),
    });
    if (!prepared.ok) {
      return { ok: false, message: prepared.message };
    }
    formData.set("cart_json", JSON.stringify(toSyncPayload(itemsRef.current)));
    formData.set("expected_total", prepared.total);
    formData.set("discount_code", discountCode.trim());
    return placeOrderAction(prev, formData);
  }, emptyActionState);

  useEffect(() => {
    if (walletSupport.loading) return;
    setPaymentMethod((current) => {
      if (current === "apple_pay" && !walletSupport.applePay) {
        return selectablePayments.find((row) => row.code === "card")?.code || selectablePayments[0]?.code || "";
      }
      if (!paymentTouchedRef.current && walletSupport.applePay && selectablePayments.some((row) => row.code === "apple_pay")) {
        return "apple_pay";
      }
      if (!selectablePayments.some((row) => row.code === current)) {
        return selectablePayments.find((row) => row.code === "card")?.code || selectablePayments[0]?.code || "";
      }
      return current;
    });
  }, [selectablePayments, walletSupport.applePay, walletSupport.loading]);

  useEffect(() => {
    if (!state.message || state.ok) return;
    if (toastedRef.current === state.message) return;
    toastedRef.current = state.message;
    toast.error(state.message);
  }, [state, toast]);

  const paysOnline = usesStripePayment(paymentMethod);
  const checkoutLocked = payPending || payProcessing || placingOrder;
  const processingMessage = placingOrder
    ? "Placing your order…"
    : payProcessing
      ? "Processing your payment…"
      : payPending
        ? "Getting payment ready…"
        : null;
  const canPlace = Boolean(
    selectedAddress && activeSlot && paymentMethod && items.length && !payModal && !checkoutLocked,
  );

  async function openPaymentModal() {
    if (!canPlace || !selectedAddress || !activeSlot) return;
    setPayPending(true);
    const prepared = await prepareCheckout({
      address_id: selectedAddress.id,
      delivery_date: activeSlot.date,
      window_id: activeSlot.window_id,
      window_source: activeSlot.source,
      payment_method: paymentMethod,
      discount_code: discountCode.trim(),
    });
    if (!prepared.ok) {
      setPayPending(false);
      toast.error(prepared.message);
      return;
    }
    const result = await prepareStripePaymentAction(prepared.total, discountCode);
    setPayPending(false);
    if (!result.ok || !result.clientSecret) {
      toast.error(result.message || "Payment could not be started.");
      return;
    }
    setPayModal({
      clientSecret: result.clientSecret,
      preferWallet: paymentMethod === "apple_pay" ? "apple_pay" : "card",
      total: prepared.total,
    });
  }

  async function onPaymentSuccess(paymentIntentId: string) {
    if (!selectedAddress || !activeSlot) return;
    setPayModal(null);
    setPayProcessing(false);
    setPlacingOrder(true);
    try {
      const prepared = await prepareCheckout({
        address_id: selectedAddress.id,
        delivery_date: activeSlot.date,
        window_id: activeSlot.window_id,
        window_source: activeSlot.source,
        payment_method: paymentMethod,
        discount_code: discountCode.trim(),
      });
      if (!prepared.ok) {
        toast.error(prepared.message);
        setPlacingOrder(false);
        return;
      }
      const note = formRef.current ? String(new FormData(formRef.current).get("note") || "") : "";
      const result = await placePaidOrderAction({
        address_id: selectedAddress.id,
        delivery_date: activeSlot.date,
        window_id: activeSlot.window_id,
        window_source: activeSlot.source,
        note,
        expected_total: prepared.total,
        payment_method: paymentMethod,
        discount_code: discountCode.trim() || null,
        stripe_payment_intent_id: paymentIntentId,
        cart_json: JSON.stringify(toSyncPayload(itemsRef.current)),
      });
      if (!result.ok || !result.orderNumber) {
        toast.error(result.message || "Order could not be placed after payment.");
        setPlacingOrder(false);
        return;
      }
      toast.success("Thank you — your order is placed.");
      router.push(`/orders/${result.orderNumber}`);
    } catch {
      setPlacingOrder(false);
    }
  }

  return (
    <CheckoutSelectionProvider setSelectedAddress={onAddressChange}>
      <div className="checkout-intro">
        <OpenBasketLink className="back-link">Back to basket</OpenBasketLink>
      </div>
      <div className="checkout-layout">
        <div className="checkout-steps-col">
          <section className="checkout-block">
            <div className="checkout-block-head">
              <div className="checkout-block-title">
                <p className="step-index">01</p>
                <h2>Deliver to</h2>
              </div>
            </div>
            <CheckoutAddressSection addresses={addresses} />
          </section>

          <section className="checkout-block">
            <p className="step-index">02</p>
            <h2>Delivery slot</h2>
            <DeliverySlotPicker
              slots={slots}
              value={activeSlot ? slotKey(activeSlot) : slotId}
              onChange={setSlotId}
            />
          </section>

          <section className="checkout-block" id="pay">
            <p className="step-index">03</p>
            <h2>Pay with</h2>
            <div className="choice-stack" role="radiogroup" aria-label="Payment methods">
              {checkoutPayments.map((method) => {
                const disabled = !isPaymentSelectable(method, walletSupport);
                return (
                  <ChoiceCard
                    key={method.code}
                    name="saved_payment"
                    value={method.code}
                    checked={paymentMethod === method.code}
                    disabled={disabled}
                    title={PAYMENT_NAME[method.code] || method.name}
                    detail={paymentMethodDetail(method, walletSupport)}
                    onChange={() => {
                      if (disabled) return;
                      paymentTouchedRef.current = true;
                      setPaymentMethod(method.code);
                    }}
                  />
                );
              })}
              {!checkoutPayments.length ? <p className="fine-print">No payment methods are available.</p> : null}
            </div>
            {showApplePayUnavailable ? (
              <p className="fine-print checkout-wallet-note">
                Apple Pay isn&apos;t available on this device. You can pay by card or cash on delivery.
              </p>
            ) : null}
          </section>

          <section className="checkout-block">
            <p className="step-index">04</p>
            <h2>Delivery note</h2>
            <label className="field">
              <span className="sr-only">Delivery note</span>
              <textarea name="note" form="place-order" rows={3} placeholder="Gate code, leave at door, call on arrival…" />
            </label>
          </section>
        </div>

        <form id="place-order" ref={formRef} action={formAction} className="order-card">
          <CheckoutCodPendingOverlay />
          <input type="hidden" name="address_id" value={selectedAddress?.id || ""} />
          <input type="hidden" name="delivery_date" value={activeSlot?.date || ""} />
          <input type="hidden" name="window_id" value={activeSlot?.window_id || ""} />
          <input type="hidden" name="window_source" value={activeSlot?.source || "weekly"} />
          <input type="hidden" name="payment_method" value={paymentMethod} />
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
                    <OptimizedImage
                      src={item.image_url}
                      alt=""
                      fill
                      sizes="54px"
                      className="object-contain"
                    />
                  ) : (
                    <span>{item.title.slice(0, 1)}</span>
                  )}
                </span>
                <span>
                  <strong>{item.title}</strong>
                  <small>
                    {item.quantity} × AED {item.unit_price}
                  </small>
                </span>
                <b>AED {lineTotal(item.unit_price, item.quantity)}</b>
              </li>
            ))}
            {!items.length ? <li className="order-empty">Your basket is empty.</li> : null}
          </ul>
          <OrderSummary showPromo className="checkout-summary" />
          {paysOnline ? (
            <button
              type="button"
              className="btn btn-primary checkout-submit"
              disabled={!canPlace}
              onClick={() => void openPaymentModal()}
            >
              <span>{placingOrder ? "Placing your order…" : payPending ? "Getting payment ready…" : "Pay now"}</span>
              <span>AED {quote.total} →</span>
            </button>
          ) : (
            <SubmitButton className="btn btn-primary checkout-submit" pendingLabel="Placing order…" disabled={!canPlace}>
              <span>Place order</span>
              <span>AED {quote.total} →</span>
            </SubmitButton>
          )}
          <p className="fine-print checkout-footnote">
            Every item in this order passed all four gates. Lab reports are on each product page.
          </p>
        </form>
      </div>
      {payModal ? (
        <CheckoutPaymentModal
          clientSecret={payModal.clientSecret}
          preferWallet={payModal.preferWallet}
          total={payModal.total}
          locked={checkoutLocked}
          onProcessingChange={setPayProcessing}
          onSuccess={(paymentIntentId) => void onPaymentSuccess(paymentIntentId)}
          onClose={() => {
            if (!checkoutLocked) setPayModal(null);
          }}
        />
      ) : null}
      {processingMessage ? <CheckoutProcessingOverlay message={processingMessage} /> : null}
    </CheckoutSelectionProvider>
  );
}
