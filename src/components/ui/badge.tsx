import type { HTMLAttributes } from "react";
import { cn } from "../../lib/utils";

type Variant =
  | "default"
  | "primary"
  | "success"
  | "warning"
  | "destructive"
  | "accent"
  | "outline";

const VARIANTS: Record<Variant, string> = {
  default: "bg-secondary text-secondary-foreground",
  primary: "bg-primary/15 text-primary border border-primary/30",
  success: "bg-success/15 text-success border border-success/30",
  warning: "bg-warning/15 text-warning border border-warning/30",
  destructive: "bg-destructive/15 text-destructive border border-destructive/30",
  accent: "bg-accent/15 text-accent border border-accent/30",
  outline: "border border-border text-muted-foreground",
};

export function Badge({
  className,
  variant = "default",
  ...props
}: HTMLAttributes<HTMLSpanElement> & { variant?: Variant }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium",
        VARIANTS[variant],
        className,
      )}
      {...props}
    />
  );
}
