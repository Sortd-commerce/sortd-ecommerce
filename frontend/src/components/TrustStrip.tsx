const PROMISES = [
  {
    index: "01",
    title: "Four gates",
    detail: "Every product here passed all four.",
  },
  {
    index: "02",
    title: "500+ refused",
    detail: "Ingredients we won't stock, published.",
  },
  {
    index: "03",
    title: "Lab reports",
    detail: "On every product page, not on request.",
  },
  {
    index: "04",
    title: "30 minutes",
    detail: "Delivered across our first community.",
  },
];

export function TrustStrip() {
  return (
    <section className="trust-strip" aria-label="How Sortd checks products">
      {PROMISES.map((item, position) => (
        <article key={item.index} className={position ? "trust-promise trust-promise-divided" : "trust-promise"}>
          <p className="trust-index">{item.index}</p>
          <h3>{item.title}</h3>
          <p>{item.detail}</p>
        </article>
      ))}
    </section>
  );
}
