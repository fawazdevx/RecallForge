import type { ReactNode } from "react";
import { Bot, Target, ClipboardCheck } from "lucide-react";
import { cn } from "../../lib/utils";

export type AgentName = "Mentor" | "Challenge" | "Evaluator";

const AGENT_META: Record<
  AgentName,
  { icon: ReactNode; ring: string; chip: string }
> = {
  Mentor: {
    icon: <Bot className="h-4 w-4" />,
    ring: "ring-primary/40 text-primary",
    chip: "bg-primary/15 text-primary",
  },
  Challenge: {
    icon: <Target className="h-4 w-4" />,
    ring: "ring-brand-2/40 text-brand-2",
    chip: "bg-brand-2/15 text-brand-2",
  },
  Evaluator: {
    icon: <ClipboardCheck className="h-4 w-4" />,
    ring: "ring-accent/40 text-accent",
    chip: "bg-accent/15 text-accent",
  },
};

/** A chat-style message bubble attributed to one of the 3 agents. */
export function AgentMessage({
  agent,
  children,
  badge,
  className,
}: {
  agent: AgentName;
  children: ReactNode;
  badge?: ReactNode;
  className?: string;
}) {
  const meta = AGENT_META[agent];
  return (
    <div className={cn("flex gap-3 animate-in", className)}>
      <div
        className={cn(
          "flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-surface-2 ring-1",
          meta.ring,
        )}
      >
        {meta.icon}
      </div>
      <div className="min-w-0 flex-1">
        <div className="mb-1 flex items-center gap-2">
          <span
            className={cn(
              "rounded-full px-2 py-0.5 text-[11px] font-semibold",
              meta.chip,
            )}
          >
            {agent} Agent
          </span>
          {badge}
        </div>
        <div className="rounded-xl rounded-tl-sm border border-border bg-surface/70 px-4 py-3 text-sm leading-relaxed text-foreground/90">
          {children}
        </div>
      </div>
    </div>
  );
}
