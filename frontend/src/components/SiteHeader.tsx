import Link from "next/link";
import { getAccessToken } from "@/lib/auth";
import { logoutAction } from "@/lib/actions";
import { CartLink } from "@/components/CartLink";

export async function SiteHeader() {
  const signedIn = Boolean(await getAccessToken());

  return (
    <header className="sticky top-0 z-20 border-b border-line/70 bg-paper/90 backdrop-blur">
      <div className="shell flex h-16 items-center justify-between gap-4">
        <Link href="/" className="font-[family-name:var(--font-display)] text-2xl font-semibold tracking-tight text-forest">
          SORTD
        </Link>
        <nav className="flex items-center gap-5 text-sm font-medium text-ink/80">
          <Link href="/" className="hover:text-forest focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-forest">
            Shop
          </Link>
          <CartLink />
          {signedIn ? (
            <>
              <Link href="/orders" className="hover:text-forest">
                Orders
              </Link>
              <form action={logoutAction}>
                <button type="submit" className="text-citrus hover:underline">
                  Log out
                </button>
              </form>
            </>
          ) : (
            <>
              <Link href="/login">Log in</Link>
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
