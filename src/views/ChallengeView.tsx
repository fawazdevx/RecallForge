import { useEffect, useState } from "react";
import {
  ArrowLeft,
  CheckCircle2,
  Lightbulb,
  Loader2,
  Send,
  Sparkles,
  Wand2,
} from "lucide-react";
import {
  SKILL_LABELS,
  type Challenge,
  type EvaluateResponse,
  type SkillArea,
} from "../../shared/schema";
import { Button } from "../components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Badge } from "../components/ui/badge";
import { Textarea } from "../components/ui/textarea";
import { ScoreRing } from "../components/ui/scoreRing";
import { AgentMessage } from "../components/ui/agentMessage";
import { ArtifactViewer } from "../components/ui/artifactViewer";
import { Skeleton } from "../components/ui/skeleton";
import { api } from "../lib/api";
import { buildRecordCheckpointTx } from "../lib/suiTx";
import { useExecuteTx } from "../lib/useExecuteTx";
import { useRecallForge } from "../context/RecallForgeContext";
import { explorerObjectUrl } from "../constants";

type Phase = "loading" | "answering" | "evaluated";

export function ChallengeView({
  focus,
  level,
  onBack,
}: {
  focus: SkillArea;
  level: number;
  onBack: () => void;
}) {
  const { network, deployed, profileId, refresh, address } = useRecallForge();
  const { execute, pending: txPending } = useExecuteTx();

  const [phase, setPhase] = useState<Phase>("loading");
  const [challenge, setChallenge] = useState<Challenge | null>(null);
  const [engine, setEngine] = useState<"claude" | "fallback">("fallback");
  const [answer, setAnswer] = useState("");
  const [revealedHints, setRevealedHints] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [evalResult, setEvalResult] = useState<EvaluateResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [checkpointId, setCheckpointId] = useState<string | null>(null);
  const [recording, setRecording] = useState(false);
  const [recordError, setRecordError] = useState<string | null>(null);

  // Generate the challenge once on mount (and on retry).
  async function generate() {
    setPhase("loading");
    setError(null);
    setChallenge(null);
    setEvalResult(null);
    setAnswer("");
    setRevealedHints(0);
    setCheckpointId(null);
    try {
      const res = await api.generateChallenge({ focus, level, weakAreas: [] });
      setChallenge(res.challenge);
      setEngine(res.engine);
      setPhase("answering");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to generate challenge");
      setPhase("answering");
    }
  }

  // Kick off generation on mount and whenever the requested focus/level change.
  useEffect(() => {
    void generate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focus, level]);

  async function submit() {
    if (!challenge || answer.trim().length === 0) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await api.evaluate({
        challenge,
        answer: answer.trim(),
        address: address ?? undefined,
      });
      setEvalResult(res);
      setPhase("evaluated");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Evaluation failed");
    } finally {
      setSubmitting(false);
    }
  }

  async function recordOnChain() {
    if (!evalResult || !challenge || !profileId) return;
    setRecording(true);
    setRecordError(null);
    try {
      const tx = buildRecordCheckpointTx(network, {
        profileId,
        skill: challenge.skill,
        level: challenge.level,
        points: evalResult.evaluation.score,
        status: evalResult.evaluation.passed ? "completed" : "attempted",
        walrusRef: evalResult.stored.blobId,
        challengeId: challenge.id,
      });
      const { createdObjectIds } = await execute(tx);
      setCheckpointId(createdObjectIds[0] ?? null);
      await refresh();
    } catch (e) {
      setRecordError(e instanceof Error ? e.message : "Failed to record checkpoint");
    } finally {
      setRecording(false);
    }
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <button
        onClick={onBack}
        className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> Back to dashboard
      </button>

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Badge variant="primary">
          <Sparkles className="h-3 w-3" />
          {SKILL_LABELS[focus]}
        </Badge>
        <Badge variant="outline">Level {level}</Badge>
        <Badge variant={engine === "claude" ? "accent" : "outline"}>
          {engine === "claude" ? "Claude-generated" : "offline engine"}
        </Badge>
      </div>

      {phase === "loading" && (
        <div className="space-y-3">
          <Skeleton className="h-8 w-2/3" />
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-24 w-full" />
        </div>
      )}

      {challenge && phase !== "loading" && (
        <>
          <Card className="glass">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Wand2 className="h-5 w-5 text-brand-2" />
                {challenge.title}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <Section label="Scenario">{challenge.scenario}</Section>
              <Section label="Your task">{challenge.prompt}</Section>

              {challenge.hints.length > 0 && (
                <div>
                  <div className="mb-2 flex items-center justify-between">
                    <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                      Hints
                    </span>
                    {revealedHints < challenge.hints.length && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setRevealedHints((n) => n + 1)}
                      >
                        <Lightbulb className="h-4 w-4" />
                        Reveal hint ({revealedHints}/{challenge.hints.length})
                      </Button>
                    )}
                  </div>
                  <div className="space-y-2">
                    {challenge.hints.slice(0, revealedHints).map((h, i) => (
                      <div
                        key={i}
                        className="rounded-lg border border-warning/30 bg-warning/10 px-3 py-2 text-sm text-foreground/90"
                      >
                        {h}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Answer box */}
          {phase === "answering" && (
            <Card className="mt-4">
              <CardHeader>
                <CardTitle className="text-base">Your answer</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <Textarea
                  value={answer}
                  onChange={(e) => setAnswer(e.target.value)}
                  placeholder="Explain your enumeration steps, the exploitation concept, and the remediation…"
                  rows={10}
                  maxLength={8000}
                />
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">
                    {answer.length}/8000
                  </span>
                  <Button
                    onClick={submit}
                    disabled={answer.trim().length === 0 || submitting}
                  >
                    {submitting ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Evaluator is grading…
                      </>
                    ) : (
                      <>
                        <Send className="h-4 w-4" />
                        Submit for evaluation
                      </>
                    )}
                  </Button>
                </div>
                {error && <p className="text-sm text-destructive">{error}</p>}
              </CardContent>
            </Card>
          )}
        </>
      )}

      {/* Evaluation result */}
      {phase === "evaluated" && evalResult && (
        <div className="mt-6 space-y-5">
          <div className="flex flex-col items-center gap-4 rounded-2xl border border-border bg-surface/60 p-6 sm:flex-row sm:items-center">
            <ScoreRing
              score={evalResult.evaluation.score}
              max={evalResult.evaluation.maxScore}
            />
            <div className="flex-1 text-center sm:text-left">
              <Badge
                variant={evalResult.evaluation.passed ? "success" : "warning"}
              >
                {evalResult.evaluation.passed ? "Passed" : "Keep practicing"}
              </Badge>
              <p className="mt-2 text-sm text-muted-foreground">
                Next focus:{" "}
                <span className="text-foreground">
                  {SKILL_LABELS[evalResult.evaluation.nextFocus]}
                </span>
              </p>
            </div>
          </div>

          <AgentMessage
            agent="Evaluator"
            badge={
              <Badge variant={evalResult.engine === "claude" ? "primary" : "outline"}>
                {evalResult.engine === "claude" ? "Claude" : "offline engine"}
              </Badge>
            }
          >
            {evalResult.evaluation.feedback}
          </AgentMessage>

          <div className="grid gap-4 sm:grid-cols-2">
            <ListCard
              title="Strengths"
              tone="success"
              items={evalResult.evaluation.strengths}
              empty="No clear strengths identified yet."
            />
            <ListCard
              title="To improve"
              tone="warning"
              items={evalResult.evaluation.weaknesses}
              empty="Nothing major — great work!"
            />
          </div>

          <div>
            <h3 className="mb-2 text-sm font-medium text-muted-foreground">
              Stored on Walrus
            </h3>
            <ArtifactViewer blobId={evalResult.stored.blobId} />
          </div>

          {/* Sui checkpoint */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Anchor on Sui</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {!deployed ? (
                <p className="text-sm text-muted-foreground">
                  Deploy the Move package to record a verifiable SkillCheckpoint
                  on-chain. (The report is already on Walrus.)
                </p>
              ) : !profileId ? (
                <p className="text-sm text-muted-foreground">
                  Create a profile first to anchor checkpoints on-chain.
                </p>
              ) : checkpointId ? (
                <div className="flex items-center gap-2 text-sm text-success">
                  <CheckCircle2 className="h-4 w-4" />
                  Checkpoint recorded.
                  <a
                    href={explorerObjectUrl(checkpointId, network)}
                    target="_blank"
                    rel="noreferrer"
                    className="text-accent hover:underline"
                  >
                    View on explorer
                  </a>
                </div>
              ) : (
                <>
                  <Button onClick={recordOnChain} disabled={recording || txPending}>
                    {recording || txPending ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Recording checkpoint…
                      </>
                    ) : (
                      <>
                        <CheckCircle2 className="h-4 w-4" />
                        Record Sui checkpoint
                      </>
                    )}
                  </Button>
                  {recordError && (
                    <p className="text-sm text-destructive">{recordError}</p>
                  )}
                </>
              )}
            </CardContent>
          </Card>

          <div className="flex gap-2">
            <Button variant="outline" className="flex-1" onClick={onBack}>
              Back to dashboard
            </Button>
            <Button className="flex-1" onClick={generate}>
              <Wand2 className="h-4 w-4" />
              New challenge
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

function Section({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="mb-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </div>
      <p className="text-sm leading-relaxed text-foreground/90">{children}</p>
    </div>
  );
}

function ListCard({
  title,
  tone,
  items,
  empty,
}: {
  title: string;
  tone: "success" | "warning";
  items: string[];
  empty: string;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        {items.length === 0 ? (
          <p className="text-sm text-muted-foreground">{empty}</p>
        ) : (
          <ul className="space-y-1.5">
            {items.map((it, i) => (
              <li key={i} className="flex items-start gap-2 text-sm">
                <span
                  className={
                    "mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full " +
                    (tone === "success" ? "bg-success" : "bg-warning")
                  }
                />
                {it}
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
