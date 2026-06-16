/**
 * Helper hook to sign+execute a Sui transaction with the connected wallet and
 * wait for it to finalize, returning the created object ids from effects.
 *
 * Mirrors the dApp-kit pattern: `dAppKit.signAndExecuteTransaction` then
 * `client.waitForTransaction`. Keeps the wallet non-custodial — the user signs
 * every write.
 */
import { useCurrentClient, useDAppKit } from "@mysten/dapp-kit-react";
import { useCallback, useState } from "react";
import type { Transaction } from "@mysten/sui/transactions";

export interface ExecResult {
  digest: string;
  createdObjectIds: string[];
}

export function useExecuteTx() {
  const client = useCurrentClient();
  const dAppKit = useDAppKit();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const execute = useCallback(
    async (tx: Transaction): Promise<ExecResult> => {
      setPending(true);
      setError(null);
      try {
        const result = await dAppKit.signAndExecuteTransaction({ transaction: tx });
        if (result.$kind === "FailedTransaction") {
          throw new Error("Transaction failed");
        }

        const digest = result.Transaction.digest;
        const txResult = await client.waitForTransaction({
          digest,
          include: { effects: true },
        });
        if (txResult.$kind === "FailedTransaction") {
          throw new Error("Transaction failed during finalization");
        }

        const created = (
          txResult.Transaction.effects?.changedObjects ?? []
        )
          .filter(
            (o: { idOperation?: string; objectId?: string }) =>
              o.idOperation === "Created" && Boolean(o.objectId),
          )
          .map((o: { objectId?: string }) => o.objectId as string);

        return { digest, createdObjectIds: created };
      } catch (e) {
        const msg = e instanceof Error ? e.message : "Transaction error";
        setError(msg);
        throw e;
      } finally {
        setPending(false);
      }
    },
    [client, dAppKit],
  );

  return { execute, pending, error, setError };
}
