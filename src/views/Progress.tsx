import { useMemo } from "react";
import { Map as MapIcon, TrendingUp } from "lucide-react";
import { SKILL_LABELS, type SkillArea } from "../../shared/schema";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Badge } from "../components/ui/badge";
import { Progress } from "../components/ui/progress";
import { Button } from "../components/ui/button";
import { EmptyState } from "../components/ui/emptyState";
import { useRecallForge } from "../context/RecallForgeContext";

// The Linux privesc track, in learning order.
const TRACK: SkillArea[] = [
  "linux-basics",
  "suid-enumeration",
  "sudo-misconfig",
  "cron-jobs",
  "path-hijacking",
  "capabilities",
];

interface SkillProgress {
  attempts: number;
  completed: number;
  bestPoints: number;
  maxLevel: number;
}

/**
 * Progress map — per-skill mastery derived purely from on-chain checkpoints.
 * Gives the learner a clear sense of what they've mastered and what's next.
 */
export function ProgressMap({
  onStart,
}: {
  onStart: (focus: SkillArea, level: number) => void;
}) {
  const { checkpoints } = useRecallForge();

  const bySkill = useMemo(() => {
    const map = new Map<SkillArea, SkillProgress>();
    for (const cp of checkpoints) {
      const prev = map.get(cp.skill) ?? {
        attempts: 0,
        completed: 0,
        bestPoints: 0,
        maxLevel: 0,
      };
      map.set(cp.skill, {
        attempts: prev.attempts + 1,
        completed: prev.completed + (cp.status === "completed" ? 1 : 0),
        bestPoints: Math.max(prev.bestPoints, cp.points),
        maxLevel: Math.max(prev.maxLevel, cp.level),
      });
    }
    return map;
  }, [checkpoints]);

  const totalCompleted = checkpoints.filter((c) => c.status === "completed").length;

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <div className="mb-6">
        <h1 className="flex items-center gap-2 text-2xl font-bold">
          <MapIcon className="h-6 w-6 text-primary" />
          Progress map
        </h1>
        <p className="text-sm text-muted-foreground">
          Your mastery across the Linux privilege-escalation track.
        </p>
      </div>

      {checkpoints.length === 0 ? (
        <EmptyState
          icon={<TrendingUp className="h-5 w-5" />}
          title="No progress yet"
          description="Complete challenges to light up your skill map."
          action={
            <Button onClick={() => onStart("linux-basics", 1)}>
              Start the track
            </Button>
          }
        />
      ) : (
        <div className="space-y-3">
          {TRACK.map((skill, idx) => {
            const p = bySkill.get(skill);
            const mastered = (p?.completed ?? 0) > 0;
            const locked =
              !p &&
              idx > 0 &&
              !bySkill.get(TRACK[idx - 1]);
            return (
              <Card key={skill} className={locked ? "opacity-60" : undefined}>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base">
                      {SKILL_LABELS[skill]}
                    </CardTitle>
                    {mastered ? (
                      <Badge variant="success">mastered</Badge>
                    ) : p ? (
                      <Badge variant="warning">in progress</Badge>
                    ) : (
                      <Badge variant="outline">not started</Badge>
                    )}
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <Progress
                    value={p?.bestPoints ?? 0}
                    max={100}
                    tone={mastered ? "success" : "brand"}
                  />
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>
                      {p
                        ? `${p.completed}/${p.attempts} completed · best ${p.bestPoints} pts · max L${p.maxLevel}`
                        : "No attempts yet"}
                    </span>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() =>
                        onStart(skill, Math.min(5, (p?.maxLevel ?? 0) + 1 || 1))
                      }
                    >
                      {p ? "Practice" : "Start"}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <p className="mt-6 text-center text-xs text-muted-foreground">
        {totalCompleted} challenge{totalCompleted === 1 ? "" : "s"} completed across the track.
      </p>
    </div>
  );
}
