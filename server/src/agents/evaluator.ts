/**
 * Evaluator Agent — grades a learner's answer against a challenge rubric.
 */
import {
  EvaluationSchema,
  type Evaluation,
  type EvaluateRequest,
} from "../../../shared/schema.js";
import { fallbackEvaluate } from "./fallback.js";
import { callClaudeJSON } from "./llm.js";
import { EVALUATOR_SYSTEM, evaluateUser } from "./prompts.js";
import type { Engine } from "./mentor.js";

export async function evaluateAnswer(
  req: EvaluateRequest,
): Promise<{ evaluation: Evaluation; engine: Engine }> {
  const llm = await callClaudeJSON({
    system: EVALUATOR_SYSTEM,
    user: evaluateUser({ challenge: req.challenge, answer: req.answer }),
    schema: EvaluationSchema,
    maxTokens: 1200,
  });

  if (llm) {
    return {
      evaluation: {
        ...llm,
        challengeId: req.challenge.id,
        skill: req.challenge.skill,
        maxScore: req.challenge.maxScore,
        score: Math.max(0, Math.min(req.challenge.maxScore, llm.score)),
        passed: llm.score / req.challenge.maxScore >= 0.6,
      },
      engine: "claude",
    };
  }
  return { evaluation: fallbackEvaluate(req), engine: "fallback" };
}
