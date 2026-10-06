import Link from "next/link";
import { OpenBasketLink } from "@/components/OpenBasketLink";

export function CheckoutGuestGate() {
  return (
    <div className="checkout-page">
      <section className="checkout-guest">
        <p className="checkout-guest-kicker">Almost there</p>
        <h1>Sign in to checkout</h1>
        <p className="checkout-guest-copy">
          Your basket stays in this browser. Sign in or create an account to add your delivery address and place your
          order.
        </p>
        <div className="checkout-guest-actions">
          <Link href="/login?next=/checkout" className="btn btn-primary">
            Sign in
          </Link>
          <Link href="/signup?next=/checkout" className="btn btn-secondary">
            Create account
          </Link>
        </div>
        <OpenBasketLink className="checkout-guest-basket">Review basket</OpenBasketLink>
      </section>
    </div>
  );
}
