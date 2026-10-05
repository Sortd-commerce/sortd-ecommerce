"use client";

import Link from "next/link";
import { House, MagnifyingGlass, ShoppingBag, User } from "@phosphor-icons/react";
import { usePathname } from "next/navigation";
import { useBasket } from "@/components/BasketProvider";
import { useCart } from "@/components/CartProvider";

export function MobileTabBar({ signedIn }: { signedIn: boolean }) {
  const pathname = usePathname();
  const { count } = useCart();
  const { open, openBasket } = useBasket();
  if (pathname.startsWith("/checkout")) return null;

  const shopOn = pathname === "/" && !open;
  const accountHref = signedIn ? "/orders" : "/login";
  const accountOn = pathname.startsWith("/orders") || pathname === "/login" || pathname === "/signup";

  return (
    <nav className="tab-bar" aria-label="App">
      <Link href="/" className={shopOn ? "tab-on" : ""} aria-current={shopOn ? "page" : undefined}>
        <House size={22} weight={shopOn ? "fill" : "bold"} />
        <span>Shop</span>
      </Link>
      <button
        type="button"
        onClick={() => {
          const input = document.getElementById("store-search");
          if (input instanceof HTMLInputElement) {
            input.focus();
            input.scrollIntoView({ behavior: "smooth", block: "center" });
            return;
          }
          window.location.href = "/#store-search";
        }}
      >
        <MagnifyingGlass size={22} weight="bold" />
        <span>Search</span>
      </button>
      <button type="button" className={open || pathname === "/cart" ? "tab-on" : ""} onClick={openBasket} aria-haspopup="dialog">
        <span className="tab-icon">
          <ShoppingBag size={22} weight={open || pathname === "/cart" ? "fill" : "bold"} />
          {count > 0 ? <span className="tab-count">{count > 99 ? "99+" : count}</span> : null}
        </span>
        <span>Basket</span>
      </button>
      <Link href={accountHref} className={accountOn ? "tab-on" : ""} aria-current={accountOn ? "page" : undefined}>
        <User size={22} weight={accountOn ? "fill" : "bold"} />
        <span>{signedIn ? "Orders" : "Account"}</span>
      </Link>
    </nav>
  );
}
