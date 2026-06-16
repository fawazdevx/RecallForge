/** Small formatting helpers shared across views. */
import { API_BASE } from "../constants";

/** Shorten a Sui address / object id for display. */
export function shortId(id: string, head = 6, tail = 4): string {
  if (!id) return "";
  if (id.length <= head + tail + 3) return id;
  return `${id.slice(0, head)}…${id.slice(-tail)}`;
}

/** Human date from epoch ms. */
export function formatDate(ms: number): string {
  if (!ms) return "—";
  return new Date(ms).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

/** Relative "time ago" string. */
export function timeAgo(ms: number): string {
  if (!ms) return "";
  const diff = Date.now() - ms;
  const sec = Math.round(diff / 1000);
  if (sec < 60) return "just now";
  const min = Math.round(sec / 60);
  if (min < 60) return `${min}m ago`;
  const hr = Math.round(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const day = Math.round(hr / 24);
  if (day < 30) return `${day}d ago`;
  return formatDate(ms);
}

/** Whether a blob id points at the local fallback cache rather than Walrus. */
export function isLocalBlob(blobId: string): boolean {
  return blobId.startsWith("local:");
}

/** Backend proxy URL to read a stored memory artifact. */
export function walrusReadUrl(blobId: string): string {
  return `${API_BASE}/api/walrus/${encodeURIComponent(blobId)}`;
}

/** Public Walrus aggregator URL (network blobs only) for an external link. */
export function walrusAggregatorUrl(blobId: string): string | null {
  if (isLocalBlob(blobId)) return null;
  return `https://aggregator.walrus-testnet.walrus.space/v1/blobs/${encodeURIComponent(blobId)}`;
}

/** Score → tailwind text color token. */
export function scoreColor(pct: number): string {
  if (pct >= 0.8) return "text-success";
  if (pct >= 0.6) return "text-accent";
  if (pct >= 0.4) return "text-warning";
  return "text-destructive";
}
