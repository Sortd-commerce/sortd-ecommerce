const PAYMENT_METHOD_LABELS: Record<string, string> = {
  cod: "Cash on delivery",
  card: "Credit or debit card",
  apple_pay: "Apple Pay",
};

export function paymentMethodLabel(code: string) {
  return PAYMENT_METHOD_LABELS[code] || code.replaceAll("_", " ");
}

export function paymentStatusLabel(status: string) {
  return status === "paid" ? "Paid" : status === "unpaid" ? "Unpaid" : status.replaceAll("_", " ");
}
