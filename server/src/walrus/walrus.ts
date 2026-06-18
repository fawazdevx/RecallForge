/**
 * Walrus memory layer.
 *
 * RecallForge persists all learning memory (onboarding summaries, attempt
 * reports, recall notes) to Walrus and keeps only the resulting blob id on
 * Sui. This module hides the transport behind a small `WalrusMemory` interface
 * so the rest of the app never cares whether a blob lives on the Walrus network
 * or in the on-disk fallback cache — and so a different backend (e.g. the
 * @mysten/walrus SDK or MemWal) could be dropped in without touching callers.
 */
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { env } from "../env.js";

export interface StoreResult {
  blobId: string;
  /** True when the blob is on the real Walrus network. */
  onWalrus: boolean;
}

export interface WalrusMemory {
  readonly mode: "network" | "local";
  store(json: unknown): Promise<StoreResult>;
  read(blobId: string): Promise<unknown>;
}

const __dirname = dirname(fileURLToPath(import.meta.url));
const CACHE_DIR = join(__dirname, "..", "..", ".walrus-cache");
const LOCAL_PREFIX = "local:";

function sha256Hex(data: string): string {
  return createHash("sha256").update(data).digest("hex");
}

/** Persist blobs to disk. Used as an explicit mode or as a network fallback. */
class LocalWalrusMemory implements WalrusMemory {
  readonly mode = "local" as const;

  async store(json: unknown): Promise<StoreResult> {
    const body = JSON.stringify(json);
    const hash = sha256Hex(body);
    await mkdir(CACHE_DIR, { recursive: true });
    await writeFile(join(CACHE_DIR, `${hash}.json`), body, "utf8");
    return { blobId: `${LOCAL_PREFIX}${hash}`, onWalrus: false };
  }

  async read(blobId: string): Promise<unknown> {
    const hash = blobId.startsWith(LOCAL_PREFIX)
      ? blobId.slice(LOCAL_PREFIX.length)
      : blobId;
    const raw = await readFile(join(CACHE_DIR, `${hash}.json`), "utf8");
    return JSON.parse(raw);
  }
}

/**
 * Store/read blobs via the Walrus HTTP publisher/aggregator. Falls back to the
 * local cache automatically if the publisher is unreachable, so a flaky network
 * never breaks a live demo.
 */
class HttpWalrusMemory implements WalrusMemory {
  readonly mode = "network" as const;
  private readonly local = new LocalWalrusMemory();

  constructor(
    private readonly publisherUrl: string,
    private readonly aggregatorUrl: string,
    private readonly epochs: number,
  ) {}

  async store(json: unknown): Promise<StoreResult> {
    const body = JSON.stringify(json);
    const url = `${this.publisherUrl}/v1/blobs?epochs=${this.epochs}`;
    try {
      const res = await fetch(url, {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body,
        signal: AbortSignal.timeout(20_000),
      });
      if (!res.ok) {
        throw new Error(`publisher responded ${res.status}`);
      }
      const data = (await res.json()) as WalrusPublishResponse;
      const blobId = extractBlobId(data);
      if (!blobId) {
        throw new Error("could not find blobId in publisher response");
      }
      return { blobId, onWalrus: true };
    } catch (err) {
      console.warn(
        `⚠️  Walrus publisher unavailable (${(err as Error).message}); ` +
          `using local cache fallback.`,
      );
      return this.local.store(json);
    }
  }

  async read(blobId: string): Promise<unknown> {
    if (blobId.startsWith(LOCAL_PREFIX)) {
      return this.local.read(blobId);
    }
    const url = `${this.aggregatorUrl}/v1/blobs/${encodeURIComponent(blobId)}`;
    const res = await fetch(url, { signal: AbortSignal.timeout(20_000) });
    if (!res.ok) {
      throw new Error(`aggregator responded ${res.status}`);
    }
    return res.json();
  }
}

interface WalrusPublishResponse {
  newlyCreated?: { blobObject?: { blobId?: string } };
  alreadyCertified?: { blobId?: string };
}

/** The publisher returns one of two shapes depending on novelty of the blob. */
function extractBlobId(data: WalrusPublishResponse): string | undefined {
  return (
    data.newlyCreated?.blobObject?.blobId ?? data.alreadyCertified?.blobId
  );
}

let instance: WalrusMemory | null = null;

/** Lazily construct the configured Walrus memory backend (singleton). */
export function getWalrus(): WalrusMemory {
  if (instance) return instance;
  instance = env.WALRUS_LOCAL
    ? new LocalWalrusMemory()
    : new HttpWalrusMemory(
        env.WALRUS_PUBLISHER_URL,
        env.WALRUS_AGGREGATOR_URL,
        env.WALRUS_EPOCHS,
      );
  return instance;
}
