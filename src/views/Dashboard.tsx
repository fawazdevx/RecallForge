import { useEffect, useState } from "react";
import {
  Award,
  Brain,
  CheckCircle2,
  Loader2,
  Play,
  RefreshCw,
  Target,
  Trophy,
} from "lucide-react";
import {
  SKILL_LABELS,
  type Recall,
  type RecalledMemory,
  type SkillArea,
} from "../../shared/schema";
import { Button } from "../components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Badge } from "../components/ui/badge";
import { Stat } from "../components/ui/stat";
import { AgentMessage } from "../components/ui/agentMessage";
import { Skeleton } from "../components/ui/skeleton";
import { EmptyState } from "../components/ui/emptyState";
import { api } from "../lib/api";
import { buildRecallHistory } from "../lib/history";
import { useRecallForge } from "../context/RecallForgeContext";

export function Dashboard({
  onStart,
}: {
  onStart: (focus: SkillArea, level: number) => void;
}) {
  const { handleName, checkpoints, profile, loading, refresh, address } =
    useDashboardData();
  const [recall, setRecall] = useState<Recall | null>(null);
  const [recallEngine, setRecallEngine] = useState<"claude" | "fallback">("fallback");
  const [recalledMemories, setRecalledMemories] = useState<RecalledMemory[]>([]);
  const [recalling, setRecalling] = useState(false);

  // Ask the Mentor to recall as soon as we have (or confirm we lack) history.
  useEffect(() => {
    let cancelled = false;
    async function run() {
      if (loading) return;
      setRecalling(true);
      try {
        const history = await buildRecallHistory(checkpoints);
        const res = await api.recall({
          handle: handleName,
          history,
          address: address ?? undefined,
        });
        if (!cancelled) {
          setRecall(res.recall);
          setRecallEngine(res.engine);
          setRecalledMemories(res.recalledMemories);
        }
      } catch {
        // Non-fatal; the dashboard still renders.
      } finally {
        if (!cancelled) setRecalling(false);
      }
    }
    void run();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, checkpoints.length, handleName, address]);

  const completed = checkpoints.filter((c) => c.status === "completed").length;
  const totalPoints =
    profile?.totalPoints ?? checkpoints.reduce((s, c) => s + c.points, 0);

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">
            Welcome back, <span className="text-gradient">{handleName}</span>
          </h1>
          <p className="text-sm text-muted-foreground">
            Your persistent cybersecurity learning dashboard.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => void refresh()}>
          <RefreshCw className="h-4 w-4" />
          Refresh
        </Button>
      </div>

      {/* Mentor recall */}
      <div className="mb-6">
        {recalling || loading ? (
          <Skeleton className="h-24 w-full" />
        ) : recall ? (
          <AgentMessage
            agent="Mentor"
            badge={
              <Badge variant={recallEngine === "claude" ? "primary" : "outline"}>
                {recallEngine === "claude" ? "Claude" : "offline engine"}
              </Badge>
            }
          >
            <p>{recall.recall}</p>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <Badge variant="accent">
                <Target className="h-3 w-3" />
                Focus: {SKILL_LABELS[recall.focusArea]}
              </Badge>
              <Badge variant="outline">Level {recall.recommendedLevel}</Badge>
              <Button
                size="sm"
                className="ml-auto"
                onClick={() => onStart(recall.focusArea, recall.recommendedLevel)}
              >
                <Play className="h-4 w-4" />
                Start recommended challenge
              </Button>
            </div>
          </AgentMessage>
        ) : null}
      </div>

      {/* MemWal semantic recall — proof the Mentor retrieved by relevance, not
          just recency. Only shown when MemWal returned memories. */}
      {!recalling && recalledMemories.length > 0 ? (
        <Card className="mb-6 border-accent/40 bg-accent/5">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-sm">
              <Brain className="h-4 w-4 text-accent" />
              Recalled from MemWal
              <Badge variant="accent">semantic · Walrus</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2">
              {recalledMemories.map((m, i) => (
                <li
                  key={i}
                  className="flex items-start justify-between gap-3 rounded-lg border border-border/60 px-3 py-2 text-sm"
                >
                  <span className="text-muted-foreground">{m.text}</span>
                  <Badge variant="outline" className="shrink-0">
                    {(1 - m.distance).toFixed(2)} match
                  </Badge>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      ) : null}

      {/* Stats */}
      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat
          label="Attempts"
          value={checkpoints.length}
          icon={<Target className="h-4 w-4" />}
        />
        <Stat
          label="Completed"
          value={completed}
          icon={<CheckCircle2 className="h-4 w-4" />}
        />
        <Stat
          label="Points"
          value={totalPoints}
          icon={<Trophy className="h-4 w-4" />}
        />
        <Stat
          label="Skills touched"
          value={new Set(checkpoints.map((c) => c.skill)).size}
          icon={<Award className="h-4 w-4" />}
        />
      </div>

      {/* Recent activity */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Recent checkpoints</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-2">
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
            </div>
          ) : checkpoints.length === 0 ? (
            <EmptyState
              icon={<Target className="h-5 w-5" />}
              title="No checkpoints yet"
              description="Start a challenge to record your first verifiable Sui checkpoint."
              action={
                <Button onClick={() => onStart("suid-enumeration", 1)}>
                  <Play className="h-4 w-4" />
                  Start first challenge
                </Button>
              }
            />
          ) : (
            <div className="space-y-2">
              {checkpoints.slice(0, 5).map((cp) => (
                <div
                  key={cp.objectId}
                  className="flex items-center justify-between rounded-lg border border-border/70 px-3 py-2"
                >
                  <div className="flex items-center gap-3">
                    {cp.status === "completed" ? (
                      <CheckCircle2 className="h-4 w-4 text-success" />
                    ) : (
                      <Loader2 className="h-4 w-4 text-warning" />
                    )}
                    <div>
                      <div className="text-sm font-medium">
                        {SKILL_LABELS[cp.skill]}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        Level {cp.level} · {cp.points} pts
                      </div>
                    </div>
                  </div>
                  <Badge variant={cp.status === "completed" ? "success" : "warning"}>
                    {cp.status}
                  </Badge>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

/** Pull together display data the dashboard needs. */
function useDashboardData() {
  const { checkpoints, profile, loading, refresh, address } = useRecallForge();
  const handleName =
    profile?.handle || (address ? address.slice(0, 6) : "learner");
  return { handleName, checkpoints, profile, loading, refresh, address };
}
