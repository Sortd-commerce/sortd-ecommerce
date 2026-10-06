import { LoadingSpinner } from "@/components/loading/LoadingSpinner";

export default function Loading() {
  return (
    <div className="flex min-h-[50vh] items-center justify-center page-loading">
      <LoadingSpinner label="Loading sign in" />
    </div>
  );
}
