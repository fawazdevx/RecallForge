/**
 * Evaluator Agent — grades a learner's answer against a challenge rubric.
 */
import {
  EvaluationSchema,
  type Evaluation,
  type EvaluateRequest,
} from "../../../shared/schema";
import { fallbackEvaluate } from "./fallback";
import { callClaudeJSON } from "./llm";
import { EVALUATOR_SYSTEM, evaluateUser } from "./prompts";
import type { Engine } from "./mentor";

export async function evaluateAnswer(
  req: EvaluateRequest,
): Promise<{ evaluation: Evaluation; engine: Engine }> {
  const llm = await callClaudeJSON({
    system: EVALUATOR_SYSTEM,
    user: evaluateUser({ challenge: req.challenge, answer: req.answer }),
    schema: EvaluationSchema,
    maxTokens: 1200,
  });

  // Pin a couple of fields to the source challenge so the UI/Sui record stays
  // consistent regardless of what the model echoed back.
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
