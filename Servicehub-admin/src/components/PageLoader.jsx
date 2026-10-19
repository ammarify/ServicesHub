import { Skeleton } from "./ui/Skeleton";

// Placeholder for a screen whose code is still downloading.
export function PageLoader() {
  return (
    <div className="flex flex-col gap-4" aria-busy="true" aria-label="Loading">
      <Skeleton className="h-5 w-40" />
      <div className="grid grid-cols-1 gap-4 min-[900px]:grid-cols-3">
        <Skeleton className="h-28 w-full" />
        <Skeleton className="h-28 w-full" />
        <Skeleton className="h-28 w-full" />
      </div>
      <Skeleton className="h-64 w-full" />
    </div>
  );
}
