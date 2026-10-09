import { BrandMark } from "@/components/BrandMark";
import { SortdAppIcon } from "@/components/SortdAppIcon";

export function RouteLoadingOverlay({ message = "Loading" }: { message?: string }) {
  return (
    <div className="route-loading-overlay" role="status" aria-live="polite" aria-busy="true" aria-label={message}>
      <div className="route-loading-overlay__backdrop" aria-hidden />
      <div className="route-loading-overlay__stage">
        <div className="route-loading-mark" aria-hidden>
          <span className="route-loading-mark__pulse" />
          <span className="route-loading-mark__pulse route-loading-mark__pulse--delay" />
          <span className="route-loading-mark__ring" />
          <SortdAppIcon className="route-loading-mark__icon" />
        </div>
        <BrandMark href={null} size="sm" />
        <p className="route-loading-message">{message}</p>
      </div>
    </div>
  );
}
