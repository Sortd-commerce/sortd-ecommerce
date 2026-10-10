"use client";

import { usePathname } from "next/navigation";
import { CartDrawer } from "@/components/CartDrawer";
import { CheckoutHeader } from "@/components/CheckoutHeader";
import { FloatingCartBar } from "@/components/FloatingCartBar";
import { MobileTabBar } from "@/components/MobileTabBar";
import { NavigationLoading } from "@/components/NavigationLoading";
import { useMobileViewport } from "@/lib/use-mobile-viewport";

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
  const mobile = useMobileViewport();

  return (
    <>
      {checkout ? (mobile ? null : <CheckoutHeader />) : pathname === "/access" ? null : header}
      <main id="main" className={`store-main ${checkout ? "store-checkout" : ""}`}>
        {children}
      </main>
      <NavigationLoading />
      <CartDrawer signedIn={signedIn} />
      <FloatingCartBar />
      <MobileTabBar signedIn={signedIn} />
    </>
  );
}
