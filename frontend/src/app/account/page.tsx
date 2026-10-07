import Link from "next/link";
import { logoutAction } from "@/lib/actions";
import { apiFetch } from "@/lib/api";

type UserProfile = {
  email: string;
  first_name: string;
  last_name: string;
  phone: string;
};

type Orders = {
  results: Array<{ number: string; status: string; total: string }>;
};

function displayName(profile: UserProfile) {
  const name = `${profile.first_name} ${profile.last_name}`.trim();
  return name || profile.email.split("@")[0];
}

export default async function AccountPage() {
  const [profile, orders] = await Promise.all([
    apiFetch<UserProfile>("/profile"),
    apiFetch<Orders>("/orders?page_size=3"),
  ]);

  if (profile.status === 401) {
    return (
      <div className="account-page">
        <section className="account-guest">
          <p className="account-kicker">Account</p>
          <h1>Sign in to your account</h1>
          <p className="account-copy">View orders and checkout faster.</p>
          <div className="account-guest-actions">
            <Link href="/?auth=login&next=/account" className="btn btn-primary">
              Sign in
            </Link>
            <Link href="/?auth=signup&next=/account" className="btn btn-secondary">
              Create account
            </Link>
          </div>
        </section>
      </div>
    );
  }

  const user = profile.data!;
  const recentOrders = orders.data?.results || [];

  return (
    <div className="account-page">
      <section className="account-hero">
        <p className="account-kicker">Your account</p>
        <h1>{displayName(user)}</h1>
        <dl className="account-meta">
          <div>
            <dt>Email</dt>
            <dd>{user.email}</dd>
          </div>
          {user.phone ? (
            <div>
              <dt>Phone</dt>
              <dd>{user.phone}</dd>
            </div>
          ) : null}
        </dl>
      </section>

      <section className="account-grid" aria-label="Account shortcuts">
        <Link href="/orders" className="account-card">
          <span className="account-card-label">Orders</span>
          <strong>{recentOrders.length ? "Recent orders" : "No orders yet"}</strong>
          <p>
            {recentOrders.length
              ? `${recentOrders[0].number} · AED ${recentOrders[0].total}`
              : "Browse products and place your first order"}
          </p>
        </Link>
        <div className="account-card account-card-static">
          <span className="account-card-label">Membership</span>
          <strong>Sortd member</strong>
          <p>Only what passes — every item checked against our four gates.</p>
        </div>
      </section>

      {recentOrders.length ? (
        <section className="account-orders">
          <div className="account-section-head">
            <h2>Recent orders</h2>
            <Link href="/orders" className="text-action">
              See all
            </Link>
          </div>
          <div className="account-order-list">
            {recentOrders.map((order) => (
              <Link key={order.number} href={`/orders/${order.number}`} className="account-order-row">
                <span>
                  <strong>{order.number}</strong>
                  <small>{order.status}</small>
                </span>
                <b>AED {order.total}</b>
              </Link>
            ))}
          </div>
        </section>
      ) : null}

      <form action={logoutAction} className="account-logout">
        <button type="submit" className="btn btn-secondary">
          Log out
        </button>
      </form>
    </div>
  );
}
