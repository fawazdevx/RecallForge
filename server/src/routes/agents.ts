/**
 * Agent + memory routes.
 *
 * Two complementary memory layers:
 *  - Raw Walrus blob + Sui checkpoint — the learner's verifiable, owned record.
 *    Onboarding/evaluation produce a `MemoryArtifact`, persisted to Walrus here;
 *    the blob id is returned and the client anchors it in a Sui `SkillCheckpoint`
 *    (signed by the user's wallet).
 *  - MemWal (semantic) — the same events are also written as natural-language
 *    memories so the Mentor can recall the *relevant* past struggle by vector
 *    search on return. Best-effort; absent/failed MemWal degrades gracefully.
 *
 * The backend itself stays stateless.
 */
import { Router } from "express";
import {
  ChallengeRequestSchema,
  EvaluateRequestSchema,
  OnboardingRequestSchema,
  RecallRequestSchema,
  type ChallengeRequest,
  type EvaluateRequest,
  type MemoryArtifact,
  type OnboardingRequest,
  type RecallRequest,
} from "../../../shared/schema.js";
import { generateChallenge } from "../agents/challenge.js";
import { evaluateAnswer } from "../agents/evaluator.js";
import { mentorRecall, mentorRoadmap } from "../agents/mentor.js";
import { getAgentMemory, nsFor } from "../memory/agentMemory.js";
import { asyncHandler } from "../middleware/asyncHandler.js";
import { rateLimit } from "../middleware/rateLimit.js";
import { body, validateBody } from "../middleware/validate.js";
import { getWalrus } from "../walrus/walrus.js";

export const agentsRouter = Router();

// Agent endpoints may incur LLM cost — rate limit them.
const agentLimiter = rateLimit({ capacity: 30, windowMs: 60_000 });

/** YYYY-MM-DD prefix for human-readable memory lines. */
function isoDate(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10);
}

agentsRouter.post(
  "/onboarding",
  agentLimiter,
  validateBody(OnboardingRequestSchema),
  asyncHandler(async (_req, res) => {
    const input = body<OnboardingRequest>(res);
    const { roadmap, engine } = await mentorRoadmap(input);

    const artifact: MemoryArtifact = {
      kind: "onboarding",
      handle: input.handle,
      skill: roadmap.focusArea,
      summary: `Onboarded ${input.handle} (${input.experience}). Focus: ${roadmap.focusArea}.`,
      detail: { roadmap, request: input },
      createdAtMs: Date.now(),
      app: "RecallForge",
      version: 1,
    };
    const stored = await getWalrus().store(artifact);

    // Also seed semantic memory so the Mentor can recall this learner later.
    await getAgentMemory().remember(
      `[${isoDate(artifact.createdAtMs)}] Onboarding — ${input.handle} (${input.experience}); ` +
        `focus area ${roadmap.focusArea}.` +
        (input.goals ? ` Goals: ${input.goals}` : ""),
      nsFor(input.address, input.handle),
    );

    res.json({ roadmap, artifact, stored, engine });
  }),
);

agentsRouter.post(
  "/mentor/recall",
  agentLimiter,
  validateBody(RecallRequestSchema),
  asyncHandler(async (_req, res) => {
    const input = body<RecallRequest>(res);

    // Semantic recall: ask MemWal for this learner's most relevant past
    // struggles, regardless of recency. Empty when MemWal is disabled.
    const recentSkill = input.history.at(-1)?.skill;
    const query =
      `What has ${input.handle} struggled with or needs to revisit in Linux ` +
      `privilege escalation${recentSkill ? ` (recently around ${recentSkill})` : ""}?`;
    const recalledMemories = await getAgentMemory().recall(
      query,
      nsFor(input.address, input.handle),
      5,
    );

    const { recall, engine } = await mentorRecall(input, recalledMemories);
    res.json({ recall, engine, recalledMemories });
  }),
);

agentsRouter.post(
  "/challenge/generate",
  agentLimiter,
  validateBody(ChallengeRequestSchema),
  asyncHandler(async (_req, res) => {
    const input = body<ChallengeRequest>(res);
    const { challenge, engine } = await generateChallenge(input);
    res.json({ challenge, engine });
  }),
);

agentsRouter.post(
  "/evaluate",
  agentLimiter,
  validateBody(EvaluateRequestSchema),
  asyncHandler(async (_req, res) => {
    const input = body<EvaluateRequest>(res);
    const { evaluation, engine } = await evaluateAnswer(input);

    const artifact: MemoryArtifact = {
      kind: "attempt-report",
      handle: input.handle ?? "anon",
      skill: evaluation.skill,
      challengeId: evaluation.challengeId,
      score: evaluation.score,
      maxScore: evaluation.maxScore,
      summary: evaluation.memorySummary,
      detail: { evaluation, challenge: input.challenge, answer: input.answer },
      createdAtMs: Date.now(),
      app: "RecallForge",
      version: 1,
    };
    const stored = await getWalrus().store(artifact);

    // Mirror the attempt into semantic memory: the natural-language summary is
    // what the Mentor later recalls ("last time you struggled with ...").
    await getAgentMemory().remember(
      `[${isoDate(artifact.createdAtMs)}] ${evaluation.skill} — scored ` +
        `${evaluation.score}/${evaluation.maxScore}: ${evaluation.memorySummary}`,
      nsFor(input.address, input.handle),
    );

    res.json({ evaluation, artifact, stored, engine });
  }),
);
