import { AlertTriangle } from "lucide-react";

/** Shown when no Move package id is configured for the active network. */
export function NotDeployedBanner({ network }: { network: string }) {
  return (
    <div className="mb-6 flex items-start gap-3 rounded-xl border border-warning/40 bg-warning/10 p-4">
      <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-warning" />
      <div className="text-sm">
        <p className="font-semibold text-warning">
          RecallForge contract not deployed for {network}
        </p>
        <p className="mt-1 text-muted-foreground">
          The AI agents and Walrus memory work now, but on-chain profile &
          checkpoint actions are disabled. Publish the Move package and set{" "}
          <code className="font-mono text-xs">
            VITE_RECALLFORGE_PACKAGE_ID_{network.toUpperCase()}
          </code>{" "}
          in your <code className="font-mono text-xs">.env</code> to enable them.
        </p>
      </div>
    </div>
  );
}
