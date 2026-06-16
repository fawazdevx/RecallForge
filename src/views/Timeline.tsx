import { useMemo } from "react";
import { Clock, Database, History } from "lucide-react";
import { SKILL_LABELS } from "../../shared/schema";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Badge } from "../components/ui/badge";
import { Skeleton } from "../components/ui/skeleton";
import { EmptyState } from "../components/ui/emptyState";
import { ArtifactViewer } from "../components/ui/artifactViewer";
import { useRecallForge } from "../context/RecallForgeContext";
import { timeAgo } from "../lib/format";

/**
 * Memory timeline — the learner's full history as a chronological feed of Sui
 * checkpoints, each linked to its Walrus memory artifact. This is the visible
 * proof that the agent's memory is real and persistent.
 */
export function Timeline() {
  const { checkpoints, loading } = useRecallForge();

  const ordered = useMemo(
    () => [...checkpoints].sort((a, b) => b.createdAtMs - a.createdAtMs),
    [checkpoints],
  );

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <div className="mb-6">
        <h1 className="flex items-center gap-2 text-2xl font-bold">
          <History className="h-6 w-6 text-primary" />
          Memory timeline
        </h1>
        <p className="text-sm text-muted-foreground">
          Every attempt is a Sui checkpoint backed by a Walrus memory artifact.
        </p>
      </div>

      {loading ? (
        <div className="space-y-3">
          <Skeleton className="h-28 w-full" />
          <Skeleton className="h-28 w-full" />
        </div>
      ) : ordered.length === 0 ? (
        <EmptyState
          icon={<Clock className="h-5 w-5" />}
          title="Your memory is empty"
          description="Complete a challenge to write your first artifact to Walrus and anchor a checkpoint on Sui."
        />
      ) : (
        <div className="relative space-y-6 border-l border-border pl-6">
          {ordered.map((cp) => (
            <div key={cp.objectId} className="relative animate-in">
              <span className="absolute -left-[1.65rem] top-1.5 flex h-3 w-3 items-center justify-center">
                <span
                  className={
                    "h-3 w-3 rounded-full ring-4 ring-background " +
                    (cp.status === "completed" ? "bg-success" : "bg-warning")
                  }
                />
              </span>
              <Card>
                <CardHeader className="pb-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <CardTitle className="text-base">
                      {SKILL_LABELS[cp.skill]}
                    </CardTitle>
                    <div className="flex items-center gap-2">
                      <Badge
                        variant={cp.status === "completed" ? "success" : "warning"}
                      >
                        {cp.status}
                      </Badge>
                      <span className="text-xs text-muted-foreground">
                        {timeAgo(cp.createdAtMs)}
                      </span>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                    <span>Level {cp.level}</span>
                    <span>·</span>
                    <span>{cp.points} points</span>
                    <span>·</span>
                    <span className="inline-flex items-center gap-1">
                      <Database className="h-3 w-3" /> {cp.challengeId}
                    </span>
                  </div>
                  {cp.walrusRef ? (
                    <ArtifactViewer blobId={cp.walrusRef} />
                  ) : (
                    <p className="text-xs text-muted-foreground">
                      No Walrus artifact linked.
                    </p>
                  )}
                </CardContent>
              </Card>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
