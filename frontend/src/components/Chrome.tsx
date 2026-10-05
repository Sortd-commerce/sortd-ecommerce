"use client";

import { Lock } from "@phosphor-icons/react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { BrandMark } from "@/components/BrandMark";
import { CartDrawer } from "@/components/CartDrawer";
import { MobileTabBar } from "@/components/MobileTabBar";

export function Chrome({
  header,
  signedIn,
  children,
}: {
  header: React.ReactNode;
  signedIn: boolean;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const checkout = pathname.startsWith("/checkout");

  return (
    <>
      {checkout ? (
        <header className="checkout-top">
          <div className="shell checkout-top-row">
            <BrandMark />
            <ol className="checkout-steps">
              <li>
                <Link href="/cart">Basket</Link>
              </li>
              <li className="step-on" aria-current="step">
                Details
              </li>
              <li>
                <a href="#pay">Pay</a>
              </li>
            </ol>
            <p className="secure-note">
              <Lock size={14} weight="bold" />
              Secure checkout
            </p>
          </div>
        </header>
      ) : (
        header
      )}
      <main id="main" className={`shell store-main ${checkout ? "store-checkout" : ""}`}>
        {children}
      </main>
      <CartDrawer />
      <MobileTabBar signedIn={signedIn} />
    </>
  );
}
