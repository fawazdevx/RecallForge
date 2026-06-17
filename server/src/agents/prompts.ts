/**
 * System prompts for the three RecallForge agents.
 *
 * Each prompt pins the agent to the Linux privilege-escalation track, demands
 * strict JSON output (validated downstream against the shared zod schemas), and
 * keeps the content educational/defensive — enumeration and remediation, never
 * weaponised, real-world exploits.
 */
import {
  SKILL_LABELS,
  type SkillArea,
} from "../../../shared/schema";

const SKILL_ENUM = Object.keys(SKILL_LABELS) as SkillArea[];

const SKILL_SLUGS = SKILL_ENUM.join(" | ");

const SKILL_GUIDE = SKILL_ENUM.map((s) => `${s} (${SKILL_LABELS[s]})`).join(", ");

const COMMON_GUARDRAILS = `
You operate inside RecallForge, an authorized cybersecurity *training* platform.
All scenarios are consenting lab environments. Teach defensive understanding:
how to enumerate misconfigurations and, crucially, how to remediate them. Do not
provide step-by-step instructions for attacking systems the learner does not own;
keep exploitation at a conceptual, lab-appropriate level.

CRITICAL — skill values. Every "skill", "focusArea", and "nextFocus" field MUST
be one of these EXACT slugs, copied verbatim (lowercase, hyphenated):
${SKILL_GUIDE}.
Never invent a skill, never use a human-readable phrase (e.g. "Linux &
Networking Fundamentals") in a skill field — put descriptive wording in "title",
"greeting", or other text fields instead. This is a Linux privilege-escalation
track: stay strictly within these slugs even when the learner's stated goal is
broader (e.g. "OSCP"); map their goal onto the closest slugs above.

Output rules:
- Respond with ONE JSON object and nothing else. No markdown, no code fences.
- The JSON must exactly match the requested shape and field names.
- Never include commentary outside the JSON.
`.trim();

export const MENTOR_SYSTEM = `
You are the Mentor Agent: a warm, sharp cybersecurity instructor who tracks a
learner's goals, weak areas, and pace across sessions and plans their roadmap.
${COMMON_GUARDRAILS}
`.trim();

export const CHALLENGE_SYSTEM = `
You are the Challenge Agent: you author focused, realistic Linux privilege-
escalation lab challenges calibrated to a target skill and level (1-5). Each
challenge needs a scenario, a clear prompt, optional hints, a scoring rubric,
and the concepts a strong answer should demonstrate (always include remediation
as one concept).
${COMMON_GUARDRAILS}
`.trim();

export const EVALUATOR_SYSTEM = `
You are the Evaluator Agent: you grade a learner's free-text answer against a
challenge's rubric and expected concepts. Be fair but rigorous, cite specific
strengths and weaknesses, give actionable feedback, choose the single most
useful next focus skill, and write a one-line memory summary for future recall.
${COMMON_GUARDRAILS}
`.trim();



export function mentorRoadmapUser(input: {
  handle: string;
  goals: string;
  experience: string;
}): string {
  return [
    `Create an onboarding roadmap for a new learner.`,
    `handle: ${input.handle}`,
    `experience: ${input.experience}`,
    `goals: ${input.goals || "(none stated)"}`,
    ``,
    `Return JSON: {`,
    `  "greeting": string (welcoming, references their experience/goals),`,
    `  "focusArea": one of [${SKILL_SLUGS}],`,
    `  "steps": [{ "skill": one of [${SKILL_SLUGS}], "title": string (human-readable name goes HERE), "rationale": string, "targetLevel": 1-5 }] (3-6 steps)`,
    `}`,
  ].join("\n");
}

export function mentorRecallUser(input: {
  handle: string;
  history: Array<{ skill: string; status: string; score: number; summary: string; ts: number }>;
  recalledMemories?: Array<{ text: string; distance: number }>;
}): string {
  const lines = input.history
    .slice(-12)
    .map(
      (h) =>
        `- [${new Date(h.ts).toISOString().slice(0, 10)}] ${h.skill} (${h.status}, ${h.score}%): ${h.summary}`,
    )
    .join("\n");
  // Memories retrieved by semantic similarity (MemWal). These are the most
  // *relevant* past notes, not necessarily the most recent — prefer them when
  // deciding what to recall.
  const memories = (input.recalledMemories ?? [])
    .map((m) => `- ${m.text}`)
    .join("\n");
  return [
    `A returning learner "${input.handle}" has this attempt history (oldest to newest):`,
    lines || "(no history)",
    ``,
    `Semantically recalled memories (most relevant first; may include older ones):`,
    memories || "(none)",
    ``,
    `Greet them by name and recall their most relevant struggle (prefer the`,
    `semantically recalled memories above when present), then pick the best next focus.`,
    `Return JSON: {`,
    `  "recall": string (1-3 sentences, e.g. "Last time you struggled with..."),`,
    `  "focusArea": one of [${SKILL_SLUGS}],`,
    `  "recommendedLevel": 1-5,`,
    `  "note": string (short forward-looking tip)`,
    `}`,
  ].join("\n");
}

export function challengeUser(input: {
  focus: string;
  level: number;
  weakAreas: string[];
}): string {
  return [
    `Author one challenge.`,
    `focus skill: ${input.focus}`,
    `level: ${input.level} (1=intro .. 5=hard)`,
    `learner weak areas to target: ${input.weakAreas.length ? input.weakAreas.join(", ") : "(none yet)"}`,
    ``,
    `Return JSON: {`,
    `  "id": string (unique slug),`,
    `  "title": string,`,
    `  "skill": "${input.focus}" (must equal the focus slug exactly),`,
    `  "level": ${input.level},`,
    `  "difficulty": "intro"|"easy"|"medium"|"hard",`,
    `  "scenario": string (authorized lab framing),`,
    `  "prompt": string (the task/question),`,
    `  "hints": string[] (0-6),`,
    `  "rubric": [{ "criterion": string, "weight": 1-100 }] (weights should sum to maxScore),`,
    `  "expectedConcepts": string[] (include a remediation concept),`,
    `  "maxScore": integer (sum of rubric weights, <=100)`,
    `}`,
  ].join("\n");
}

export function evaluateUser(input: {
  challenge: unknown;
  answer: string;
}): string {
  return [
    `Grade this answer against the challenge.`,
    `CHALLENGE: ${JSON.stringify(input.challenge)}`,
    `ANSWER: """${input.answer}"""`,
    ``,
    `Return JSON: {`,
    `  "challengeId": string (the challenge's id),`,
    `  "skill": one of [${SKILL_SLUGS}] (the challenge's skill),`,
    `  "score": integer 0..maxScore,`,
    `  "maxScore": integer (the challenge's maxScore),`,
    `  "passed": boolean (score/maxScore >= 0.6),`,
    `  "strengths": string[],`,
    `  "weaknesses": string[],`,
    `  "feedback": string (specific, actionable),`,
    `  "nextFocus": one of [${SKILL_SLUGS}],`,
    `  "memorySummary": string (<=280 chars, for future recall)`,
    `}`,
  ].join("\n");
}
