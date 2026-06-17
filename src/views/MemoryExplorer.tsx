import { useState } from "react";
import {
  Brain,
  Database,
  ExternalLink,
  RefreshCw,
  Search,
  Sparkles,
} from "lucide-react";
import type { RecalledMemory } from "../../shared/schema";
import { Button } from "../components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Badge } from "../components/ui/badge";
import { EmptyState } from "../components/ui/emptyState";
import { api } from "../lib/api";
import { walrusAggregatorUrl } from "../lib/format";
import { useRecallForge } from "../context/RecallForgeContext";
import { AgentPermissions } from "./AgentPermissions";

/**
 * Memory Explorer — a developer-tool surface over the agent's MemWal memory on
 * Walrus. Lets you semantically search what the agent remembers, see the raw
 * Walrus blob behind each memory, and rebuild the whole index from Walrus
 * (proving the memory is durable and portable, not trapped in a local DB).
 */
export function MemoryExplorer() {
  const { address, profile } = useRecallForge();
  const handle = profile?.handle;

  const [query, setQuery] = useState("");
  const [results, setResults] = useState<RecalledMemory[]>([]);
  const [namespace, setNamespace] = useState<string>("");
  const [enabled, setEnabled] = useState<boolean | null>(null);
  const [searching, setSearching] = useState(false);
  const [searched, setSearched] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [restoring, setRestoring] = useState(false);
  const [restoreMsg, setRestoreMsg] = useState<string | null>(null);

  async function runSearch() {
    if (query.trim().length === 0) return;
    setSearching(true);
    setError(null);
    try {
      const res = await api.memorySearch({
        query: query.trim(),
        address: address ?? undefined,
        handle: handle ?? undefined,
        limit: 10,
      });
      setResults(res.results);
      setNamespace(res.namespace);
      setEnabled(res.enabled);
      setSearched(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Search failed");
    } finally {
      setSearching(false);
    }
  }

  async function runRestore() {
    setRestoring(true);
    setRestoreMsg(null);
    setError(null);
    try {
      const res = await api.memoryRestore({
        address: address ?? undefined,
        handle: handle ?? undefined,
        limit: 50,
      });
      setEnabled(res.enabled);
      setNamespace(res.namespace);
      setRestoreMsg(
        res.enabled
          ? `Rebuilt from Walrus: ${res.restored} restored, ${res.skipped} already indexed (${res.total} on-chain).`
          : "MemWal is disabled — nothing to restore.",
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Restore failed");
    } finally {
      setRestoring(false);
    }
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <div className="mb-6">
        <h1 className="flex items-center gap-2 text-2xl font-bold">
          <Brain className="h-6 w-6 text-primary" />
          Memory Explorer
        </h1>
        <p className="text-sm text-muted-foreground">
          Inspect what your agent remembers — semantic search over memories
          stored on Walrus, with the raw blob behind each.
        </p>
      </div>

      {/* Search bar */}
      <Card className="mb-4">
        <CardContent className="pt-6">
          <div className="flex flex-col gap-3 sm:flex-row">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") void runSearch();
                }}
                placeholder="e.g. what did I struggle with in SUID enumeration?"
                className="w-full rounded-lg border border-border bg-surface/60 py-2 pl-9 pr-3 text-sm outline-none focus:border-primary"
              />
            </div>
            <Button onClick={() => void runSearch()} disabled={searching}>
              <Sparkles className="h-4 w-4" />
              {searching ? "Searching…" : "Recall"}
            </Button>
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
            {enabled === false ? (
              <Badge variant="warning">MemWal disabled — set credentials</Badge>
            ) : enabled === true ? (
              <Badge variant="accent">
                <Brain className="h-3 w-3" /> semantic · Walrus
              </Badge>
            ) : null}
            {namespace ? (
              <span className="text-muted-foreground">
                namespace: <code>{namespace}</code>
              </span>
            ) : null}
          </div>
        </CardContent>
      </Card>

      {error ? (
        <p className="mb-4 rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </p>
      ) : null}

      {/* Results */}
      {searched && results.length === 0 && !searching ? (
        <EmptyState
          icon={<Search className="h-5 w-5" />}
          title="No memories found"
          description={
            enabled === false
              ? "MemWal is not configured, so there is no semantic memory to search yet."
              : "No stored memories matched that query. Complete a challenge to create some."
          }
        />
      ) : (
        <div className="space-y-2">
          {results.map((m, i) => {
            const aggUrl = m.blobId ? walrusAggregatorUrl(m.blobId) : null;
            const matchPct = Math.max(0, Math.min(100, Math.round((1 - m.distance) * 100)));
            return (
              <Card key={i}>
                <CardContent className="flex items-start justify-between gap-3 pt-4">
                  <div className="space-y-1">
                    <p className="text-sm">{m.text}</p>
                    {m.blobId ? (
                      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        <Database className="h-3 w-3" />
                        {aggUrl ? (
                          <a
                            href={aggUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1 hover:text-primary"
                          >
                            view raw blob on Walrus
                            <ExternalLink className="h-3 w-3" />
                          </a>
                        ) : (
                          <span>{m.blobId}</span>
                        )}
                      </div>
                    ) : null}
                  </div>
                  <Badge variant="outline" className="shrink-0">
                    {matchPct}% match
                  </Badge>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Restore from Walrus */}
      <Card className="mt-6 border-accent/40 bg-accent/5">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-sm">
            <RefreshCw className="h-4 w-4 text-accent" />
            Restore memory from Walrus
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Rebuild the entire semantic index from your Walrus blobs — proof your
            memory is durable and portable, not locked in a local database.
          </p>
          <Button
            variant="outline"
            onClick={() => void runRestore()}
            disabled={restoring}
          >
            <RefreshCw className="h-4 w-4" />
            {restoring ? "Restoring…" : "Restore from Walrus"}
          </Button>
          {restoreMsg ? (
            <p className="text-xs text-muted-foreground">{restoreMsg}</p>
          ) : null}
        </CardContent>
      </Card>

      {/* On-chain agent permissions */}
      <AgentPermissions />
    </div>
  );
}
