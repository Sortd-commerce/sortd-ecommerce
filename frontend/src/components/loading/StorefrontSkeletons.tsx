export function LoadingSpinner({ label = "Loading" }: { label?: string }) {
  return (
    <div className="loading-spinner" role="status" aria-live="polite" aria-label={label}>
      <span className="loading-spinner__ring" aria-hidden />
      <span className="loading-spinner__label">{label}</span>
    </div>
  );
}

function Block({ className = "" }: { className?: string }) {
  return <div className={`skeleton ${className}`.trim()} aria-hidden />;
}

export function DeliverBarSkeleton() {
  return (
    <div className="deliver-bar deliver-bar--skeleton" aria-hidden>
      <div className="header-inner deliver-row">
        <Block className="skeleton--deliver" />
        <Block className="skeleton--promise" />
      </div>
    </div>
  );
}

export function SearchFormSkeleton() {
  return <div className="search-form skeleton skeleton--search" aria-hidden />;
}

export function HomePageSkeleton() {
  return (
    <div className="home page-loading" aria-busy="true" aria-label="Loading store">
      <section className="home-section home-section--tight">
        <div className="home-inner aisle-picker">
          <Block className="skeleton--title" />
          <div className="aisle-row">
            {Array.from({ length: 6 }).map((_, index) => (
              <Block key={index} className="skeleton--aisle" />
            ))}
          </div>
        </div>
      </section>
      <section className="home-section">
        <div className="home-inner">
          <Block className="skeleton--title" />
          <div className="product-rail product-rail--skeleton">
            {Array.from({ length: 4 }).map((_, index) => (
              <Block key={index} className="skeleton--product-card" />
            ))}
          </div>
        </div>
      </section>
      <section className="home-section home-section--promo">
        <div className="home-inner promo-grid">
          <Block className="skeleton--promo" />
          <Block className="skeleton--promo" />
        </div>
      </section>
    </div>
  );
}

export function ProductPageSkeleton() {
  return (
    <div className="product-page page-loading" aria-busy="true" aria-label="Loading product">
      <section className="home-section">
        <div className="home-inner product-layout">
          <Block className="skeleton--gallery" />
          <div className="product-buy-stack">
            <Block className="skeleton--title skeleton--title-lg" />
            <Block className="skeleton--line" />
            <Block className="skeleton--line skeleton--line-short" />
            <Block className="skeleton--buybox" />
          </div>
        </div>
      </section>
    </div>
  );
}

export function CheckoutPageSkeleton() {
  return (
    <div className="checkout-page page-loading" aria-busy="true" aria-label="Loading checkout">
      <div className="checkout-layout">
        <div className="checkout-main">
          <Block className="skeleton--title" />
          <Block className="skeleton--panel" />
          <Block className="skeleton--panel" />
          <Block className="skeleton--panel" />
        </div>
        <Block className="skeleton--summary" />
      </div>
    </div>
  );
}

export function AccountPageSkeleton() {
  return (
    <div className="account-page page-loading" aria-busy="true" aria-label="Loading account">
      <Block className="skeleton--title skeleton--title-lg" />
      <Block className="skeleton--panel" />
      <Block className="skeleton--panel" />
      <Block className="skeleton--panel" />
    </div>
  );
}

export function AddressesPageSkeleton() {
  return (
    <div className="addresses-page page-loading" aria-busy="true" aria-label="Loading addresses">
      <Block className="skeleton--title skeleton--title-lg" />
      <Block className="skeleton--line skeleton--line-short" />
      <div className="addresses-list addresses-list--skeleton">
        {Array.from({ length: 3 }).map((_, index) => (
          <Block key={index} className="skeleton--address-row" />
        ))}
      </div>
    </div>
  );
}

export function OrdersPageSkeleton() {
  return (
    <div className="orders-page page-loading" aria-busy="true" aria-label="Loading orders">
      <Block className="skeleton--title skeleton--title-lg" />
      {Array.from({ length: 4 }).map((_, index) => (
        <Block key={index} className="skeleton--order-row" />
      ))}
    </div>
  );
}

export function OrderDetailSkeleton() {
  return (
    <div className="orders-page page-loading" aria-busy="true" aria-label="Loading order">
      <Block className="skeleton--title skeleton--title-lg" />
      <Block className="skeleton--panel skeleton--panel-tall" />
      <Block className="skeleton--panel" />
    </div>
  );
}
