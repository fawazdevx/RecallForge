/** Animated circular score gauge (SVG). */
export function ScoreRing({
  score,
  max,
  size = 120,
  stroke = 10,
}: {
  score: number;
  max: number;
  size?: number;
  stroke?: number;
}) {
  const pct = max > 0 ? Math.max(0, Math.min(1, score / max)) : 0;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const offset = c * (1 - pct);
  const color =
    pct >= 0.8
      ? "var(--color-success)"
      : pct >= 0.6
        ? "var(--color-accent)"
        : pct >= 0.4
          ? "var(--color-warning)"
          : "var(--color-destructive)";

  return (
    <div className="relative inline-flex" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="var(--color-secondary)"
          strokeWidth={stroke}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={offset}
          style={{ transition: "stroke-dashoffset 0.8s ease" }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-2xl font-bold tabular-nums">
          {Math.round(pct * 100)}%
        </span>
        <span className="text-[10px] uppercase tracking-wide text-muted-foreground">
          {score}/{max}
        </span>
      </div>
    </div>
  );
}
