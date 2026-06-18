/**
 * Semantic agent-memory layer (MemWal / Walrus Memory).
 *
 * This is the *recall-by-relevance* layer that sits alongside — not instead of —
 * the verifiable Walrus blob + Sui checkpoint record (`../walrus/walrus.ts`).
 *
 * - Raw Walrus + Sui  → the learner's owned, verifiable record (source of truth).
 * - MemWal (here)     → vector memory the Mentor queries to recall the *relevant*
 *                       past struggle ("what did they trip on in privesc?"),
 *                       regardless of recency.
 *
 * MemWal does all embedding / SEAL-encryption / Walrus upload server-side (TEE);
 * the SDK just signs requests with an Ed25519 delegate key. Everything here is
 * best-effort: if MemWal is unconfigured or unreachable, the app degrades to
 * chronological recall and never throws into a request handler — mirroring the
 * Walrus publisher fallback and the Anthropic-key fallback.
 */
import { MemWal } from "@mysten-incubation/memwal";
import { env, hasMemWal } from "../env.js";

/** A single relevant memory surfaced by semantic search (lower distance = closer). */
export interface RecalledMemory {
  text: string;
  distance: number;
  blobId?: string;
}

/** Outcome of rebuilding a namespace's vector index from Walrus. */
export interface RestoreOutcome {
  restored: number;
  skipped: number;
  total: number;
}

export interface AgentMemory {
  /** True only when MemWal credentials are configured. */
  readonly enabled: boolean;
  /** Store a natural-language memory for `namespace`. Best-effort, non-throwing. */
  remember(text: string, namespace: string): Promise<void>;
  /** Semantically recall memories for `namespace`. Returns [] on any failure. */
  recall(query: string, namespace: string, limit?: number): Promise<RecalledMemory[]>;
  /** Rebuild a namespace's local vector index from its Walrus blobs. */
  restore(namespace: string, limit?: number): Promise<RestoreOutcome>;
}

/** How long to wait on a recall (embed → search → download → decrypt) before giving up. */
const RECALL_TIMEOUT_MS = 15_000;
/** Restore re-downloads + re-embeds many blobs; allow more headroom. */
const RESTORE_TIMEOUT_MS = 60_000;

function withTimeout<T>(p: Promise<T>, ms: number, label: string): Promise<T> {
  return Promise.race([
    p,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms),
    ),
  ]);
}

/** Real MemWal-backed memory. */
class MemWalAgentMemory implements AgentMemory {
  readonly enabled = true;
  private client: MemWal | null = null;

  private getClient(): MemWal {
    if (!this.client) {
      this.client = MemWal.create({
        key: env.MEMWAL_DELEGATE_KEY as string,
        accountId: env.MEMWAL_ACCOUNT_ID as string,
        serverUrl: env.MEMWAL_SERVER_URL,
        namespace: env.MEMWAL_NAMESPACE_PREFIX,
      });
    }
    return this.client;
  }

  async remember(text: string, namespace: string): Promise<void> {
    try {
      // Accept-only: the relayer finishes embedding/encrypting/uploading in the
      // background. We don't block the request on indexing — the payoff is
      // next-session recall, and chronological history covers the same session.
      await this.getClient().remember(text, namespace);
    } catch (err) {
      console.warn(`⚠️  MemWal remember failed (${(err as Error).message}); skipped.`);
    }
  }

  async recall(query: string, namespace: string, limit = 5): Promise<RecalledMemory[]> {
    try {
      const res = await withTimeout(
        this.getClient().recall({ query, namespace, limit }),
        RECALL_TIMEOUT_MS,
        "MemWal recall",
      );
      return res.results.map((m) => ({
        text: m.text,
        distance: m.distance,
        blobId: m.blob_id,
      }));
    } catch (err) {
      console.warn(`⚠️  MemWal recall failed (${(err as Error).message}); falling back.`);
      return [];
    }
  }

  async restore(namespace: string, limit = 50): Promise<RestoreOutcome> {
    try {
      const res = await withTimeout(
        this.getClient().restore(namespace, limit),
        RESTORE_TIMEOUT_MS,
        "MemWal restore",
      );
      return {
        restored: res.restored,
        skipped: res.skipped,
        total: res.total,
      };
    } catch (err) {
      console.warn(`⚠️  MemWal restore failed (${(err as Error).message}); skipped.`);
      return { restored: 0, skipped: 0, total: 0 };
    }
  }
}

/** No-op memory used when MemWal is not configured. */
class DisabledAgentMemory implements AgentMemory {
  readonly enabled = false;
  async remember(): Promise<void> {
    /* no-op */
  }
  async recall(): Promise<RecalledMemory[]> {
    return [];
  }
  async restore(): Promise<RestoreOutcome> {
    return { restored: 0, skipped: 0, total: 0 };
  }
}

let instance: AgentMemory | null = null;

/** Lazily construct the configured agent-memory backend (singleton). */
export function getAgentMemory(): AgentMemory {
  if (!instance) {
    instance = hasMemWal ? new MemWalAgentMemory() : new DisabledAgentMemory();
  }
  return instance;
}

/**
 * Build the MemWal namespace for a learner. Scopes memories per wallet (falls
 * back to handle, then "anon"), so one learner never recalls another's memory.
 */
export function nsFor(address?: string | null, handle?: string | null): string {
  const id = (address || handle || "anon").trim() || "anon";
  return `${env.MEMWAL_NAMESPACE_PREFIX}:${id}`;
}
