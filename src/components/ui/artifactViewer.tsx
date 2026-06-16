import { useState } from "react";
import { Database, ExternalLink, HardDrive, Loader2 } from "lucide-react";
import { Badge } from "./badge";
import { Button } from "./button";
import {
  isLocalBlob,
  shortId,
  walrusAggregatorUrl,
  walrusReadUrl,
} from "../../lib/format";

/**
 * Renders a Walrus memory artifact reference: shows the blob id, where it lives
 * (Walrus network vs local fallback), a link to the public aggregator, and an
 * on-demand fetch of the raw JSON via the backend proxy.
 */
export function ArtifactViewer({ blobId }: { blobId: string }) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<unknown>(null);
  const [error, setError] = useState<string | null>(null);

  const local = isLocalBlob(blobId);
  const aggUrl = walrusAggregatorUrl(blobId);

  async function toggle() {
    if (open) {
      setOpen(false);
      return;
    }
    setOpen(true);
    if (data) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(walrusReadUrl(blobId));
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error ?? "Failed to load blob");
      setData(json.data ?? json);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="rounded-xl border border-border bg-surface/60">
      <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-3">
        <div className="flex items-center gap-2">
          {local ? (
            <HardDrive className="h-4 w-4 text-warning" />
          ) : (
            <Database className="h-4 w-4 text-accent" />
          )}
          <span className="text-sm font-medium">Walrus artifact</span>
          <Badge variant={local ? "warning" : "accent"}>
            {local ? "local cache" : "on Walrus"}
          </Badge>
        </div>
        <code className="font-mono text-xs text-muted-foreground">
          {shortId(blobId, 10, 6)}
        </code>
      </div>
      <div className="flex items-center gap-2 border-t border-border px-4 py-2">
        <Button size="sm" variant="outline" onClick={toggle}>
          {open ? "Hide" : "View"} JSON
        </Button>
        {aggUrl && (
          <a
            href={aggUrl}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 text-xs text-accent hover:underline"
          >
            Open aggregator <ExternalLink className="h-3 w-3" />
          </a>
        )}
      </div>
      {open && (
        <div className="max-h-72 overflow-auto border-t border-border bg-background/60 p-3">
          {loading && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Loading from Walrus…
            </div>
          )}
          {error && <p className="text-sm text-destructive">{error}</p>}
          {!loading && !error && (
            <pre className="whitespace-pre-wrap break-words font-mono text-xs text-foreground/80">
              {JSON.stringify(data, null, 2)}
            </pre>
          )}
        </div>
      )}
    </div>
  );
}
