/**
 * Sui transaction builders for RecallForge.
 *
 * All on-chain writes are constructed here as `Transaction` objects and signed
 * by the user's wallet via dApp Kit — the backend never holds the learner's key
 * (non-custodial). We use explicit `tx.moveCall` with the deployed package id so
 * the app works without generated bindings.
 */
import { Transaction } from "@mysten/sui/transactions";
import { SUI_CLOCK_OBJECT_ID } from "@mysten/sui/utils";
import { MODULE, getPackageId, type SuiNetwork } from "../constants";
import { CHECKPOINT_STATUS, type SkillArea } from "../../shared/schema";

function target(network: SuiNetwork, fn: string): `${string}::${string}::${string}` {
  return `${getPackageId(network)}::${MODULE}::${fn}`;
}

/** Create a LearnerProfile owned by the signer. */
export function buildCreateProfileTx(network: SuiNetwork, handle: string): Transaction {
  const tx = new Transaction();
  tx.moveCall({
    target: target(network, "create_profile"),
    arguments: [tx.pure.string(handle), tx.object(SUI_CLOCK_OBJECT_ID)],
  });
  return tx;
}

export interface RecordCheckpointArgs {
  profileId: string;
  skill: SkillArea;
  level: number;
  points: number;
  status: "attempted" | "completed";
  walrusRef: string;
  challengeId: string;
}

/** Record a SkillCheckpoint and update the profile aggregates. */
export function buildRecordCheckpointTx(
  network: SuiNetwork,
  args: RecordCheckpointArgs,
): Transaction {
  const tx = new Transaction();
  tx.moveCall({
    target: target(network, "record_checkpoint"),
    arguments: [
      tx.object(args.profileId),
      tx.pure.string(args.skill),
      tx.pure.u8(clampU8(args.level)),
      tx.pure.u64(BigInt(Math.max(0, Math.round(args.points)))),
      tx.pure.u8(CHECKPOINT_STATUS[args.status]),
      tx.pure.string(args.walrusRef),
      tx.pure.string(args.challengeId),
      tx.object(SUI_CLOCK_OBJECT_ID),
    ],
  });
  return tx;
}

/** Promote an existing checkpoint to completed with a final Walrus report. */
export function buildCompleteCheckpointTx(
  network: SuiNetwork,
  args: { checkpointId: string; profileId: string; walrusRef: string },
): Transaction {
  const tx = new Transaction();
  tx.moveCall({
    target: target(network, "complete_checkpoint"),
    arguments: [
      tx.object(args.checkpointId),
      tx.object(args.profileId),
      tx.pure.string(args.walrusRef),
      tx.object(SUI_CLOCK_OBJECT_ID),
    ],
  });
  return tx;
}

function clampU8(n: number): number {
  return Math.max(0, Math.min(255, Math.round(n)));
}
