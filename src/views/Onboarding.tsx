import { useState } from "react";
import { Loader2, Rocket, UserPlus } from "lucide-react";
import {
  SKILL_LABELS,
  type OnboardingResponse,
} from "../../shared/schema";
import { Button } from "../components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Badge } from "../components/ui/badge";
import { AgentMessage } from "../components/ui/agentMessage";
import { ArtifactViewer } from "../components/ui/artifactViewer";
import { NotDeployedBanner } from "../components/ui/notDeployedBanner";
import { api } from "../lib/api";
import { buildCreateProfileTx } from "../lib/suiTx";
import { useExecuteTx } from "../lib/useExecuteTx";
import { useRecallForge } from "../context/RecallForgeContext";

type Experience = "beginner" | "intermediate" | "advanced";

export function Onboarding({ onComplete }: { onComplete: () => void }) {
  const { network, deployed, setProfileId, refresh, address } = useRecallForge();
  const { execute, pending: txPending } = useExecuteTx();

  const [handle, setHandle] = useState("");
  const [experience, setExperience] = useState<Experience>("beginner");
  const [goals, setGoals] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<OnboardingResponse | null>(null);

  const canSubmit = handle.trim().length >= 2 && !submitting && !txPending;

  async function handleSubmit() {
    setError(null);
    setSubmitting(true);
    try {
      // 1) Mentor Agent designs a roadmap + writes an onboarding artifact to Walrus.
      const res = await api.onboarding({
        handle: handle.trim(),
        experience,
        goals: goals.trim(),
        address: address ?? undefined,
      });
      setResult(res);

      // 2) If the contract is deployed, create the on-chain LearnerProfile.
      if (deployed) {
        const tx = buildCreateProfileTx(network, handle.trim());
        const { createdObjectIds } = await execute(tx);
        const profileId = createdObjectIds[0];
        if (profileId) {
          setProfileId(profileId);
          await refresh();
        }
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Onboarding failed");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-10">
      {!deployed && <NotDeployedBanner network={network} />}

      <Card className="glass">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <UserPlus className="h-5 w-5 text-primary" />
            Create your RecallForge profile
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          <Field label="Handle">
            <input
              value={handle}
              onChange={(e) => setHandle(e.target.value)}
              placeholder="e.g. nightowl"
              maxLength={64}
              className="w-full rounded-lg border border-input bg-background/60 px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60"
            />
          </Field>

          <Field label="Experience">
            <div className="grid grid-cols-3 gap-2">
              {(["beginner", "intermediate", "advanced"] as Experience[]).map(
                (lvl) => (
                  <button
                    key={lvl}
                    onClick={() => setExperience(lvl)}
                    className={
                      "rounded-lg border px-3 py-2 text-sm capitalize transition-colors " +
                      (experience === lvl
                        ? "border-primary bg-primary/15 text-primary"
                        : "border-border hover:bg-secondary")
                    }
                  >
                    {lvl}
                  </button>
                ),
              )}
            </div>
          </Field>

          <Field label="Your goal (optional)">
            <input
              value={goals}
              onChange={(e) => setGoals(e.target.value)}
              placeholder="e.g. pass OSCP privilege-escalation sections"
              maxLength={200}
              className="w-full rounded-lg border border-input bg-background/60 px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60"
            />
          </Field>

          {error && (
            <p className="rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {error}
            </p>
          )}

          {!result && (
            <Button
              size="lg"
              className="w-full"
              disabled={!canSubmit}
              onClick={handleSubmit}
            >
              {submitting || txPending ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  {txPending ? "Creating on-chain profile…" : "Mentor is planning…"}
                </>
              ) : (
                <>
                  <Rocket className="h-4 w-4" />
                  Start learning
                </>
              )}
            </Button>
          )}
        </CardContent>
      </Card>

      {result && (
        <div className="mt-6 space-y-5">
          <AgentMessage
            agent="Mentor"
            badge={
              <Badge variant={result.engine === "claude" ? "primary" : "outline"}>
                {result.engine === "claude" ? "Claude" : "offline engine"}
              </Badge>
            }
          >
            {result.roadmap.greeting}
          </AgentMessage>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Your roadmap</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {result.roadmap.steps.map((step, i) => (
                <div
                  key={`${step.skill}-${i}`}
                  className="flex items-start gap-3 rounded-lg border border-border/70 p-3"
                >
                  <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/15 text-xs font-semibold text-primary">
                    {i + 1}
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{SKILL_LABELS[step.skill]}</span>
                      <Badge variant="outline">L{step.targetLevel}</Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">{step.rationale}</p>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          <ArtifactViewer blobId={result.stored.blobId} />

          <Button size="lg" className="w-full" onClick={onComplete}>
            Go to dashboard
          </Button>
        </div>
      )}
    </div>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </label>
      {children}
    </div>
  );
}
