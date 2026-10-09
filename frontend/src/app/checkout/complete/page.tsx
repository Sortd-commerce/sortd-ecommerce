import Link from "next/link";
import { redirect } from "next/navigation";
import { completeStripeCheckoutAction } from "@/lib/actions";

export default async function CheckoutCompletePage({
  searchParams,
}: {
  searchParams: Promise<{ session_id?: string }>;
}) {
  const { session_id: sessionId = "" } = await searchParams;
  if (!sessionId.trim()) {
    redirect("/checkout");
  }

  const result = await completeStripeCheckoutAction(sessionId.trim());
  if (result.ok && result.orderNumber) {
    redirect(`/orders/${result.orderNumber}?placed=1`);
  }

  return (
    <div className="checkout-page checkout-page--mobile">
      <div className="checkout-mobile-step">
        <section className="checkout-block">
          <h2>Payment received</h2>
          <p className="fine-print">
            {result.message || "We could not confirm your order yet. If you were charged, contact support and we will help."}
          </p>
          <Link href="/checkout" className="btn btn-primary" style={{ marginTop: "1rem", display: "inline-flex" }}>
            Back to checkout
          </Link>
        </section>
      </div>
    </div>
  );
}
