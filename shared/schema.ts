/**
 * Shared zod schemas and types — the single source of truth for the data that
 * flows between the RecallForge frontend (`src/`) and backend (`server/`).
 *
 * Keeping these in one place means an agent response that type-checks on the
 * server is guaranteed to match what the UI renders. The backend validates
 * every LLM output against these schemas before returning it, so malformed or
 * hallucinated model output can never reach the client.
 */
import { z } from "zod";

// ===== Primitives =====

export const SKILL_TRACK = "linux-privesc" as const;

export const SkillAreaSchema = z.enum([
  "linux-basics",
  "suid-enumeration",
  "sudo-misconfig",
  "cron-jobs",
  "path-hijacking",
  "capabilities",
  "kernel-exploits",
  "secure-coding",
]);
export type SkillArea = z.infer<typeof SkillAreaSchema>;

export const LevelSchema = z.number().int().min(1).max(5);

export const DifficultySchema = z.enum(["intro", "easy", "medium", "hard"]);
export type Difficulty = z.infer<typeof DifficultySchema>;

// ===== Challenge =====

export const RubricItemSchema = z.object({
  /** Short label for the scoring dimension. */
  criterion: z.string().min(1).max(160),
  /** Points awarded when this criterion is fully met. */
  weight: z.number().int().min(1).max(100),
});
export type RubricItem = z.infer<typeof RubricItemSchema>;

export const ChallengeSchema = z.object({
  id: z.string().min(1).max(128),
  title: z.string().min(1).max(160),
  skill: SkillAreaSchema,
  level: LevelSchema,
  difficulty: DifficultySchema,
  /** Realistic lab framing for the task. */
  scenario: z.string().min(1).max(4000),
  /** The actual question / task posed to the learner. */
  prompt: z.string().min(1).max(2000),
  hints: z.array(z.string().min(1).max(500)).max(6),
  rubric: z.array(RubricItemSchema).min(1).max(8),
  /** Concepts a strong answer should demonstrate (used by the evaluator). */
  expectedConcepts: z.array(z.string().min(1).max(200)).min(1).max(12),
  maxScore: z.number().int().min(1).max(100),
});
export type Challenge = z.infer<typeof ChallengeSchema>;

// ===== Evaluation =====

export const EvaluationSchema = z.object({
  challengeId: z.string().min(1).max(128),
  skill: SkillAreaSchema,
  score: z.number().int().min(0).max(100),
  maxScore: z.number().int().min(1).max(100),
  passed: z.boolean(),
  strengths: z.array(z.string().min(1).max(400)).max(8),
  weaknesses: z.array(z.string().min(1).max(400)).max(8),
  /** Narrative feedback shown to the learner. */
  feedback: z.string().min(1).max(4000),
  /** The single most important area to focus on next. */
  nextFocus: SkillAreaSchema,
  /** One-line summary persisted to Walrus memory for future recall. */
  memorySummary: z.string().min(1).max(280),
});
export type Evaluation = z.infer<typeof EvaluationSchema>;

// ===== Roadmap / onboarding =====

export const RoadmapStepSchema = z.object({
  skill: SkillAreaSchema,
  title: z.string().min(1).max(160),
  rationale: z.string().min(1).max(600),
  targetLevel: LevelSchema,
});
export type RoadmapStep = z.infer<typeof RoadmapStepSchema>;

export const RoadmapSchema = z.object({
  greeting: z.string().min(1).max(1200),
  focusArea: SkillAreaSchema,
  steps: z.array(RoadmapStepSchema).min(1).max(8),
});
export type Roadmap = z.infer<typeof RoadmapSchema>;

// ===== Mentor recall =====

export const RecallSchema = z.object({
  /** The headline recall line, e.g. "Last time you struggled with…". */
  recall: z.string().min(1).max(1200),
  focusArea: SkillAreaSchema,
  recommendedLevel: LevelSchema,
  /** A short forward-looking note for the dashboard. */
  note: z.string().min(1).max(600),
});
export type Recall = z.infer<typeof RecallSchema>;

// ===== Memory artifact (what we store on Walrus) =====

export const MemoryKindSchema = z.enum([
  "onboarding",
  "attempt-report",
  "recall",
]);
export type MemoryKind = z.infer<typeof MemoryKindSchema>;

export const MemoryArtifactSchema = z.object({
  kind: MemoryKindSchema,
  handle: z.string().max(64),
  skill: SkillAreaSchema.optional(),
  challengeId: z.string().max(128).optional(),
  score: z.number().int().min(0).max(100).optional(),
  maxScore: z.number().int().min(1).max(100).optional(),
  summary: z.string().max(2000),
  detail: z.unknown().optional(),
  createdAtMs: z.number().int().nonnegative(),
  app: z.literal("RecallForge"),
  version: z.literal(1),
});
export type MemoryArtifact = z.infer<typeof MemoryArtifactSchema>;

// ===== API request bodies =====

const HandleSchema = z.string().trim().min(2).max(64);
const AnswerSchema = z.string().trim().min(1).max(8000);
/** Connected wallet address, used to scope a learner's MemWal memory namespace. */
const AddressSchema = z.string().trim().max(120).optional();

export const OnboardingRequestSchema = z.object({
  handle: HandleSchema,
  goals: z.string().trim().max(1000).default(""),
  experience: z.enum(["beginner", "intermediate", "advanced"]),
  address: AddressSchema,
});
export type OnboardingRequest = z.infer<typeof OnboardingRequestSchema>;

export const RecallHistoryItemSchema = z.object({
  skill: SkillAreaSchema,
  status: z.enum(["attempted", "completed"]),
  score: z.number().int().min(0).max(100),
  summary: z.string().max(2000),
  ts: z.number().int().nonnegative(),
});
export type RecallHistoryItem = z.infer<typeof RecallHistoryItemSchema>;

export const RecallRequestSchema = z.object({
  handle: HandleSchema,
  history: z.array(RecallHistoryItemSchema).max(50),
  address: AddressSchema,
});
export type RecallRequest = z.infer<typeof RecallRequestSchema>;

export const ChallengeRequestSchema = z.object({
  handle: HandleSchema.optional(),
  focus: SkillAreaSchema,
  level: LevelSchema,
  /** Optional weak-area hints from prior attempts to target the challenge. */
  weakAreas: z.array(z.string().max(200)).max(12).default([]),
});
export type ChallengeRequest = z.infer<typeof ChallengeRequestSchema>;

export const EvaluateRequestSchema = z.object({
  handle: HandleSchema.optional(),
  challenge: ChallengeSchema,
  answer: AnswerSchema,
  address: AddressSchema,
});
export type EvaluateRequest = z.infer<typeof EvaluateRequestSchema>;

// ===== API response bodies =====

export const StoredSchema = z.object({
  /** Walrus blob id (or `local:<hash>` when the local fallback is used). */
  blobId: z.string(),
  /** True when the blob lives on the real Walrus network. */
  onWalrus: z.boolean(),
});
export type Stored = z.infer<typeof StoredSchema>;

export const OnboardingResponseSchema = z.object({
  roadmap: RoadmapSchema,
  artifact: MemoryArtifactSchema,
  stored: StoredSchema,
  engine: z.enum(["claude", "fallback"]),
});
export type OnboardingResponse = z.infer<typeof OnboardingResponseSchema>;

/** A memory surfaced by MemWal semantic search (lower distance = more relevant). */
export const RecalledMemorySchema = z.object({
  text: z.string().max(2000),
  distance: z.number(),
  /** Walrus blob id backing this memory (absent on older entries). */
  blobId: z.string().optional(),
});
export type RecalledMemory = z.infer<typeof RecalledMemorySchema>;

// ===== Memory Explorer / Restore (dev-tool surface over MemWal) =====

export const MemorySearchRequestSchema = z.object({
  query: z.string().trim().min(1).max(400),
  address: z.string().trim().max(120).optional(),
  handle: z.string().trim().max(64).optional(),
  limit: z.number().int().min(1).max(20).default(10),
});
export type MemorySearchRequest = z.infer<typeof MemorySearchRequestSchema>;

export const MemorySearchResponseSchema = z.object({
  enabled: z.boolean(),
  namespace: z.string(),
  results: z.array(RecalledMemorySchema),
});
export type MemorySearchResponse = z.infer<typeof MemorySearchResponseSchema>;

export const MemoryRestoreRequestSchema = z.object({
  address: z.string().trim().max(120).optional(),
  handle: z.string().trim().max(64).optional(),
  limit: z.number().int().min(1).max(100).default(50),
});
export type MemoryRestoreRequest = z.infer<typeof MemoryRestoreRequestSchema>;

export const MemoryRestoreResponseSchema = z.object({
  enabled: z.boolean(),
  namespace: z.string(),
  restored: z.number().int().nonnegative(),
  skipped: z.number().int().nonnegative(),
  total: z.number().int().nonnegative(),
});
export type MemoryRestoreResponse = z.infer<typeof MemoryRestoreResponseSchema>;

export const RecallResponseSchema = z.object({
  recall: RecallSchema,
  engine: z.enum(["claude", "fallback"]),
  /** Semantically recalled memories (MemWal). Empty array when MemWal is disabled. */
  recalledMemories: z.array(RecalledMemorySchema),
});
export type RecallResponse = z.infer<typeof RecallResponseSchema>;

export const ChallengeResponseSchema = z.object({
  challenge: ChallengeSchema,
  engine: z.enum(["claude", "fallback"]),
});
export type ChallengeResponse = z.infer<typeof ChallengeResponseSchema>;

export const EvaluateResponseSchema = z.object({
  evaluation: EvaluationSchema,
  artifact: MemoryArtifactSchema,
  stored: StoredSchema,
  engine: z.enum(["claude", "fallback"]),
});
export type EvaluateResponse = z.infer<typeof EvaluateResponseSchema>;

export const HealthResponseSchema = z.object({
  ok: z.literal(true),
  engine: z.enum(["claude", "fallback"]),
  walrus: z.enum(["network", "local"]),
  memwal: z.boolean(),
  network: z.string(),
});
export type HealthResponse = z.infer<typeof HealthResponseSchema>;

// ===== Display helpers shared by both sides =====

export const SKILL_LABELS: Record<SkillArea, string> = {
  "linux-basics": "Linux Basics",
  "suid-enumeration": "SUID Enumeration",
  "sudo-misconfig": "Sudo Misconfiguration",
  "cron-jobs": "Cron Job Abuse",
  "path-hijacking": "PATH Hijacking",
  capabilities: "Linux Capabilities",
  "kernel-exploits": "Kernel Exploits",
  "secure-coding": "Secure Coding",
};

export const CHECKPOINT_STATUS = {
  attempted: 0,
  completed: 1,
} as const;
