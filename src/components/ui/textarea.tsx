import type { TextareaHTMLAttributes } from "react";
import { cn } from "../../lib/utils";

export function Textarea({
  className,
  ref,
  ...props
}: TextareaHTMLAttributes<HTMLTextAreaElement> & {
  ref?: React.Ref<HTMLTextAreaElement>;
}) {
  return (
    <textarea
      ref={ref}
      className={cn(
        "flex min-h-24 w-full rounded-lg border border-input bg-background/60 px-3 py-2 text-sm",
        "placeholder:text-muted-foreground/70 focus-visible:outline-none focus-visible:ring-2",
        "focus-visible:ring-ring/60 focus-visible:border-ring disabled:opacity-50 resize-y",
        "font-mono leading-relaxed",
        className,
      )}
      {...props}
    />
  );
}
