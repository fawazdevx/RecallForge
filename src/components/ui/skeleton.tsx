import { cn } from "../../lib/utils";

/** Shimmering placeholder block for loading states. */
export function Skeleton({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "animate-pulse rounded-md bg-secondary/60",
        className,
      )}
    />
  );
}
