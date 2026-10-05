import Link from "next/link";
import { getAccessToken } from "@/lib/auth";
import { logoutAction } from "@/lib/actions";
import { CartLink } from "@/components/CartLink";

export async function SiteHeader() {
  const signedIn = Boolean(await getAccessToken());

  return (
    <header className="site-header">
      <div className="shell flex h-16 items-center justify-between gap-4 md:h-[4.25rem]">
        <Link href="/" className="brand-mark">
          SORTD
        </Link>
        <nav className="flex items-center gap-1 text-sm font-medium text-ink/80 md:gap-2">
          <Link href="/" className="nav-link">
            Shop
          </Link>
          <CartLink />
          {signedIn ? (
            <>
              <Link href="/orders" className="nav-link">
                Orders
              </Link>
              <form action={logoutAction}>
                <button type="submit" className="nav-link text-citrus">
                  Log out
                </button>
              </form>
            </>
          ) : (
            <>
              <Link href="/login" className="nav-link">
                Log in
              </Link>
              <Link href="/signup" className="btn btn-primary !px-3.5 !py-2 text-sm">
                Sign up
              </Link>
            </>
          )}
        </nav>
      </div>
    </header>
  );
}
