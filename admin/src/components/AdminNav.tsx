import Link from "next/link";
import { logoutAction } from "@/lib/actions";
import { getAccessToken } from "@/lib/auth";

const links = [
  { href: "/", label: "Dashboard" },
  { href: "/orders", label: "Orders" },
  { href: "/products", label: "Products" },
  { href: "/delivery", label: "Delivery" },
];

export async function AdminNav() {
  const signedIn = Boolean(await getAccessToken());
  if (!signedIn) return null;

  return (
    <header className="sticky top-0 z-20 border-b border-line bg-bg/90 backdrop-blur">
      <div className="shell flex h-14 items-center justify-between gap-4">
        <div className="flex min-w-0 items-center gap-6">
          <Link href="/" className="shrink-0 text-sm font-semibold tracking-wide text-text">
            SORTD Admin
          </Link>
          <nav className="flex gap-4 text-sm">
            {links.map((link) => (
              <Link key={link.href} href={link.href} className="nav-link hover:text-text">
                {link.label}
              </Link>
            ))}
          </nav>
        </div>
        <form action={logoutAction}>
          <button type="submit" className="btn btn-ghost text-sm">
            Log out
          </button>
        </form>
      </div>
    </header>
  );
}
