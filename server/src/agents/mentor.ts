/**
 * Mentor Agent — onboarding roadmaps and cross-session recall.
 */
import {
  RecallSchema,
  RoadmapSchema,
  type OnboardingRequest,
  type Recall,
  type RecalledMemory,
  type RecallRequest,
  type Roadmap,
} from "../../../shared/schema";
import { fallbackRecall, fallbackRoadmap } from "./fallback";
import { callClaudeJSON } from "./llm";
import { MENTOR_SYSTEM, mentorRecallUser, mentorRoadmapUser } from "./prompts";

export type Engine = "claude" | "fallback";

export async function mentorRoadmap(
  req: OnboardingRequest,
): Promise<{ roadmap: Roadmap; engine: Engine }> {
  const llm = await callClaudeJSON({
    system: MENTOR_SYSTEM,
    user: mentorRoadmapUser(req),
    schema: RoadmapSchema,
    maxTokens: 1200,
  });
  if (llm) return { roadmap: llm, engine: "claude" };
  return { roadmap: fallbackRoadmap(req), engine: "fallback" };
}

export async function mentorRecall(
  req: RecallRequest,
  recalledMemories: RecalledMemory[] = [],
): Promise<{ recall: Recall; engine: Engine }> {
  const llm = await callClaudeJSON({
    system: MENTOR_SYSTEM,
    user: mentorRecallUser({ ...req, recalledMemories }),
    schema: RecallSchema,
    maxTokens: 800,
  });
  if (llm) return { recall: llm, engine: "claude" };
  return { recall: fallbackRecall(req, recalledMemories), engine: "fallback" };
}
