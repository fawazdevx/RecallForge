import { cn } from "../../lib/utils";

/** A simple horizontal progress bar with a brand gradient fill. */
export function Progress({
  value,
  max = 100,
  className,
  tone = "brand",
}: {
  value: number;
  max?: number;
  className?: string;
  tone?: "brand" | "success" | "warning" | "destructive";
}) {
  const pct = Math.max(0, Math.min(100, (value / max) * 100));
  const fill =
    tone === "success"
      ? "bg-success"
      : tone === "warning"
        ? "bg-warning"
        : tone === "destructive"
          ? "bg-destructive"
          : "bg-gradient-to-r from-primary via-brand-2 to-accent";
  return (
    <div
      className={cn(
        "h-2 w-full overflow-hidden rounded-full bg-secondary",
        className,
      )}
    >
      <div
        className={cn("h-full rounded-full transition-all duration-500", fill)}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}
