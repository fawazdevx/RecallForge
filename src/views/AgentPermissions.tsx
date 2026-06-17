import { useCallback, useEffect, useState } from "react";
import { KeyRound, ShieldCheck, ShieldX, ExternalLink } from "lucide-react";
import { Button } from "../components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Badge } from "../components/ui/badge";
import { useRecallForge } from "../context/RecallForgeContext";
import { useExecuteTx } from "../lib/useExecuteTx";
import { buildGrantAgentTx, buildRevokeAgentTx } from "../lib/suiTx";
import {
  fetchPermissions,
  type OnchainPermission,
} from "../lib/suiRead";
import { explorerObjectUrl } from "../constants";
import { formatDate } from "../lib/format";

/**
 * On-chain agent permissions — the learner grants a named agent scoped,
 * revocable access to their memory, enforced by the Move contract. Every grant
 * and revoke is a wallet-signed Sui transaction that emits an on-chain event,
 * making agent authority verifiable and user-controlled.
 */
export function AgentPermissions() {
  const { network, address, deployed } = useRecallForge();
  const { execute, pending } = useExecuteTx();

  const [perms, setPerms] = useState<OnchainPermission[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [agentName, setAgentName] = useState("Mentor Agent");
  const [canRead, setCanRead] = useState(true);
  const [canWrite, setCanWrite] = useState(false);

  const load = useCallback(async () => {
    if (!address || !deployed) return;
    setLoading(true);
    try {
      setPerms(await fetchPermissions(network, address));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load permissions");
    } finally {
      setLoading(false);
    }
  }, [address, deployed, network]);

  useEffect(() => {
    void load();
  }, [load]);

  async function grant() {
    if (agentName.trim().length === 0) return;
    setError(null);
    try {
      await execute(
        buildGrantAgentTx(network, {
          agentName: agentName.trim(),
          canReadMemory: canRead,
          canWriteMemory: canWrite,
          expiresAtMs: 0,
        }),
      );
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Grant failed");
    }
  }

  async function revoke(id: string) {
    setError(null);
    try {
      await execute(buildRevokeAgentTx(network, id));
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Revoke failed");
    }
  }

  if (!deployed) return null;

  return (
    <Card className="mt-6">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-sm">
          <KeyRound className="h-4 w-4 text-primary" />
          Agent permissions (on-chain)
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">
          Grant an agent scoped, revocable access to your memory. Each grant and
          revoke is a wallet-signed Sui transaction — agent authority is
          verifiable on-chain and always under your control.
        </p>

        {/* Grant form */}
        <div className="flex flex-col gap-3 rounded-lg border border-border/70 p-3 sm:flex-row sm:items-end">
          <label className="flex-1 text-xs text-muted-foreground">
            Agent name
            <input
              value={agentName}
              onChange={(e) => setAgentName(e.target.value)}
              className="mt-1 w-full rounded-lg border border-border bg-surface/60 px-3 py-2 text-sm text-foreground outline-none focus:border-primary"
            />
          </label>
          <label className="inline-flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={canRead}
              onChange={(e) => setCanRead(e.target.checked)}
            />
            read
          </label>
          <label className="inline-flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={canWrite}
              onChange={(e) => setCanWrite(e.target.checked)}
            />
            write
          </label>
          <Button onClick={() => void grant()} disabled={pending}>
            <ShieldCheck className="h-4 w-4" />
            Grant
          </Button>
        </div>

        {error ? (
          <p className="text-sm text-destructive">{error}</p>
        ) : null}

        {/* Existing grants */}
        {loading ? (
          <p className="text-xs text-muted-foreground">Loading permissions…</p>
        ) : perms.length === 0 ? (
          <p className="text-xs text-muted-foreground">
            No agent permissions granted yet.
          </p>
        ) : (
          <ul className="space-y-2">
            {perms.map((p) => (
              <li
                key={p.objectId}
                className="flex items-center justify-between gap-3 rounded-lg border border-border/70 px-3 py-2 text-sm"
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{p.agentName}</span>
                    {p.revoked ? (
                      <Badge variant="outline">revoked</Badge>
                    ) : (
                      <Badge variant="success">active</Badge>
                    )}
                  </div>
                  <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                    {p.canReadMemory ? <Badge variant="accent">read</Badge> : null}
                    {p.canWriteMemory ? <Badge variant="accent">write</Badge> : null}
                    <span>
                      expires:{" "}
                      {p.expiresAtMs === 0 ? "never" : formatDate(p.expiresAtMs)}
                    </span>
                    <a
                      href={explorerObjectUrl(p.objectId, network)}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 hover:text-primary"
                    >
                      on Suiscan <ExternalLink className="h-3 w-3" />
                    </a>
                  </div>
                </div>
                {!p.revoked ? (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => void revoke(p.objectId)}
                    disabled={pending}
                  >
                    <ShieldX className="h-4 w-4" />
                    Revoke
                  </Button>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
