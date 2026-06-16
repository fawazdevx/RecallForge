/**
 * Build the Mentor's recall history from on-chain checkpoints + Walrus reports.
 *
 * Each `SkillCheckpoint` references a Walrus blob holding the full attempt
 * report (including the evaluator's `memorySummary` and score). We read the most
 * recent few via the backend proxy so the Mentor can recall specifics like
 * "last time you struggled with SUID enumeration".
 */
import type { MemoryArtifact, RecallHistoryItem } from "../../shared/schema";
import { MemoryArtifactSchema } from "../../shared/schema";
import type { OnchainCheckpoint } from "./suiRead";
import { walrusReadUrl } from "./format";

async function readArtifact(blobId: string): Promise<MemoryArtifact | null> {
  try {
    const res = await fetch(walrusReadUrl(blobId));
    if (!res.ok) return null;
    const json = await res.json();
    const parsed = MemoryArtifactSchema.safeParse(json?.data ?? json);
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

export async function buildRecallHistory(
  checkpoints: OnchainCheckpoint[],
  limit = 8,
): Promise<RecallHistoryItem[]> {
  // Most recent first (checkpoints arrive sorted newest-first already).
  const recent = checkpoints.slice(0, limit);

  const items = await Promise.all(
    recent.map(async (cp): Promise<RecallHistoryItem> => {
      const artifact = cp.walrusRef ? await readArtifact(cp.walrusRef) : null;
      const maxScore = artifact?.maxScore ?? 100;
      const rawScore = artifact?.score ?? cp.points;
      const scorePct =
        maxScore > 0 ? Math.round((rawScore / maxScore) * 100) : rawScore;
      return {
        skill: cp.skill,
        status: cp.status,
        score: Math.max(0, Math.min(100, scorePct)),
        summary: artifact?.summary ?? `Attempted ${cp.skill}.`,
        ts: cp.createdAtMs,
      };
    }),
  );

  // Oldest → newest for the Mentor prompt.
  return items.reverse();
}
