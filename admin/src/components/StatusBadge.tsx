export function StatusBadge({ value }: { value: string }) {
  const tone =
    value === "delivered" || value === "active" || value === "admin" || value === "paid"
      ? "bg-accent/15 text-accent"
      : value === "cancelled" || value === "inactive"
        ? "bg-danger/15 text-danger"
        : value === "out_for_delivery" || value === "placed" || value === "member" || value === "unpaid"
          ? "bg-warn/15 text-warn"
          : "bg-white/8 text-text";
  const label = value.replaceAll("_", " ");
  return <span className={`badge ${tone}`}>{label}</span>;
}
