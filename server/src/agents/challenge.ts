/**
 * Challenge Agent — authors a focused lab challenge for a skill + level.
 */
import {
  ChallengeSchema,
  type Challenge,
  type ChallengeRequest,
} from "../../../shared/schema";
import { fallbackChallenge } from "./fallback";
import { callClaudeJSON } from "./llm";
import { CHALLENGE_SYSTEM, challengeUser } from "./prompts";
import type { Engine } from "./mentor";

export async function generateChallenge(
  req: ChallengeRequest,
): Promise<{ challenge: Challenge; engine: Engine }> {
  const llm = await callClaudeJSON({
    system: CHALLENGE_SYSTEM,
    user: challengeUser({
      focus: req.focus,
      level: req.level,
      weakAreas: req.weakAreas,
    }),
    schema: ChallengeSchema,
    maxTokens: 1600,
  });

  
  if (llm && llm.skill === req.focus) {
    return { challenge: llm, engine: "claude" };
  }
  return { challenge: fallbackChallenge(req), engine: "fallback" };
}
