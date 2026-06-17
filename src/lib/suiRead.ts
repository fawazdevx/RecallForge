/**
 * Read-side Sui access (decentralized recall).
 *
 * RecallForge keeps no server-side user database — a learner's history lives in
 * their own `SkillCheckpoint` objects on Sui (with full reports on Walrus). This
 * module reads those objects via JSON-RPC and parses them into typed records the
 * dashboard, timeline, and progress map render from.
 */
import {
  SuiJsonRpcClient,
  getJsonRpcFullnodeUrl,
} from "@mysten/sui/jsonRpc";
import { MODULE, getPackageId, type SuiNetwork } from "../constants";
import type { SkillArea } from "../../shared/schema";

export interface OnchainCheckpoint {
  objectId: string;
  skill: SkillArea;
  level: number;
  points: number;
  status: "attempted" | "completed";
  walrusRef: string;
  challengeId: string;
  createdAtMs: number;
  completedAtMs: number;
}

export interface OnchainProfile {
  objectId: string;
  handle: string;
  totalPoints: number;
  completedCount: number;
  attemptedCount: number;
  createdAtMs: number;
}

export interface OnchainPermission {
  objectId: string;
  agentName: string;
  canReadMemory: boolean;
  canWriteMemory: boolean;
  expiresAtMs: number;
  revoked: boolean;
}

const clients = new Map<SuiNetwork, SuiJsonRpcClient>();

export function getReadClient(network: SuiNetwork): SuiJsonRpcClient {
  let c = clients.get(network);
  if (!c) {
    c = new SuiJsonRpcClient({
      url: getJsonRpcFullnodeUrl(network),
      network,
    });
    clients.set(network, c);
  }
  return c;
}

/** Read a learner's profile object (returns null if not found / wrong type). */
export async function fetchProfile(
  network: SuiNetwork,
  profileId: string,
): Promise<OnchainProfile | null> {
  const client = getReadClient(network);
  const res = await client.getObject({
    id: profileId,
    options: { showContent: true },
  });
  const content = res.data?.content;
  if (!content || content.dataType !== "moveObject") return null;
  const f = content.fields as Record<string, unknown>;
  return {
    objectId: profileId,
    handle: String(f.handle ?? ""),
    totalPoints: num(f.total_points),
    completedCount: num(f.completed_count),
    attemptedCount: num(f.attempted_count),
    createdAtMs: num(f.created_at_ms),
  };
}

/** Read all `SkillCheckpoint` objects owned by an address, newest first. */
export async function fetchCheckpoints(
  network: SuiNetwork,
  owner: string,
): Promise<OnchainCheckpoint[]> {
  const client = getReadClient(network);
  const pkg = getPackageId(network);
  const structType = `${pkg}::${MODULE}::SkillCheckpoint`;

  const out: OnchainCheckpoint[] = [];
  let cursor: string | null | undefined = undefined;

  // Paginate through owned objects of our checkpoint type.
  do {
    const page = await client.getOwnedObjects({
      owner,
      filter: { StructType: structType },
      options: { showContent: true },
      cursor: cursor ?? null,
    });
    for (const item of page.data) {
      const content = item.data?.content;
      if (!content || content.dataType !== "moveObject") continue;
      const f = content.fields as Record<string, unknown>;
      out.push({
        objectId: String(item.data?.objectId ?? ""),
        skill: String(f.skill ?? "linux-basics") as SkillArea,
        level: num(f.level),
        points: num(f.points),
        status: num(f.status) === 1 ? "completed" : "attempted",
        walrusRef: String(f.walrus_ref ?? ""),
        challengeId: String(f.challenge_id ?? ""),
        createdAtMs: num(f.created_at_ms),
        completedAtMs: num(f.completed_at_ms),
      });
    }
    cursor = page.hasNextPage ? page.nextCursor : null;
  } while (cursor);

  return out.sort((a, b) => b.createdAtMs - a.createdAtMs);
}

/** Read all `AgentPermission` objects owned by an address. */
export async function fetchPermissions(
  network: SuiNetwork,
  owner: string,
): Promise<OnchainPermission[]> {
  const client = getReadClient(network);
  const pkg = getPackageId(network);
  const structType = `${pkg}::${MODULE}::AgentPermission`;

  const out: OnchainPermission[] = [];
  let cursor: string | null | undefined = undefined;

  do {
    const page = await client.getOwnedObjects({
      owner,
      filter: { StructType: structType },
      options: { showContent: true },
      cursor: cursor ?? null,
    });
    for (const item of page.data) {
      const content = item.data?.content;
      if (!content || content.dataType !== "moveObject") continue;
      const f = content.fields as Record<string, unknown>;
      out.push({
        objectId: String(item.data?.objectId ?? ""),
        agentName: String(f.agent_name ?? ""),
        canReadMemory: Boolean(f.can_read_memory),
        canWriteMemory: Boolean(f.can_write_memory),
        expiresAtMs: num(f.expires_at_ms),
        revoked: Boolean(f.revoked),
      });
    }
    cursor = page.hasNextPage ? page.nextCursor : null;
  } while (cursor);

  return out;
}

/** Move u64 fields arrive as strings over JSON-RPC; coerce safely. */
function num(v: unknown): number {
  if (typeof v === "number") return v;
  if (typeof v === "string") {
    const n = Number(v);
    return Number.isFinite(n) ? n : 0;
  }
  return 0;
}
