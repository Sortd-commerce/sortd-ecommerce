export function LoadingSpinner({ label = "Loading" }: { label?: string }) {
  return (
    <div className="loading-spinner" role="status" aria-live="polite" aria-label={label}>
      <span className="loading-spinner__ring" aria-hidden />
      <span className="loading-spinner__label">{label}</span>
    </div>
  );
}
