"use client";

import { usePathname } from "next/navigation";
import { CartDrawer } from "@/components/CartDrawer";
import { CheckoutHeader } from "@/components/CheckoutHeader";
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
      {checkout ? <CheckoutHeader /> : header}
      <main id="main" className={`store-main ${checkout ? "store-checkout" : ""}`}>
        {children}
      </main>
      <CartDrawer />
      <MobileTabBar signedIn={signedIn} />
    </>
  );
}
