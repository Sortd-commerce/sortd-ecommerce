import { RouteLoadingBoundarySignal } from "@/components/RouteLoadingBoundarySignal";
import { AddressesPageSkeleton } from "@/components/loading/StorefrontSkeletons";

export default function Loading() {
  return (
    <>
      <RouteLoadingBoundarySignal />
      <AddressesPageSkeleton />
    </>
  );
}
