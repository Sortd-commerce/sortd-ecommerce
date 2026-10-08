"use client";

import Link from "next/link";
import { House, MagnifyingGlass, ShoppingBag, User } from "@phosphor-icons/react";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { useAuth } from "@/components/auth/AuthProvider";
import { MobileAccountSheet } from "@/components/MobileAccountSheet";
import { useBasket } from "@/components/BasketProvider";
import { useCart } from "@/components/CartProvider";

export function MobileTabBar({ signedIn }: { signedIn: boolean }) {
  const pathname = usePathname();
  const { count } = useCart();
  const { open, openBasket } = useBasket();
  const { openAuth, user } = useAuth();
  const [accountOpen, setAccountOpen] = useState(false);
  if (pathname.startsWith("/checkout")) return null;

  const shopOn = pathname === "/" && !open;
  const accountOn =
    accountOpen ||
    pathname.startsWith("/orders") ||
    pathname.startsWith("/addresses") ||
    pathname === "/login" ||
    pathname === "/signup";

  return (
    <>
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
        <button type="button" className={open ? "tab-on" : ""} onClick={openBasket} aria-haspopup="dialog">
          <span className="tab-icon">
            <ShoppingBag size={22} weight={open ? "fill" : "bold"} />
            {count > 0 ? <span className="tab-count">{count > 99 ? "99+" : count}</span> : null}
          </span>
          <span>Basket</span>
        </button>
        {signedIn && user ? (
          <button
            type="button"
            className={accountOn ? "tab-on" : ""}
            aria-haspopup="dialog"
            aria-expanded={accountOpen}
            onClick={() => setAccountOpen(true)}
          >
            <User size={22} weight={accountOn ? "fill" : "bold"} />
            <span>Account</span>
          </button>
        ) : (
          <button type="button" className={accountOn ? "tab-on" : ""} onClick={() => openAuth("login", pathname || "/")}>
            <User size={22} weight={accountOn ? "fill" : "bold"} />
            <span>Account</span>
          </button>
        )}
      </nav>
      {signedIn && user ? (
        <MobileAccountSheet user={user} open={accountOpen} onClose={() => setAccountOpen(false)} />
      ) : null}
    </>
  );
}
