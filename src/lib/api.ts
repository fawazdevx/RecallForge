/**
 * Typed client for the RecallForge backend API.
 *
 * Every response is parsed against the shared zod schemas, so the UI works with
 * fully-typed, validated data and a malformed backend response surfaces as a
 * clear error rather than a runtime crash deep in a component.
 */
import {
  ChallengeResponseSchema,
  EvaluateResponseSchema,
  HealthResponseSchema,
  MemoryRestoreResponseSchema,
  MemorySearchResponseSchema,
  OnboardingResponseSchema,
  RecallResponseSchema,
  type ChallengeRequest,
  type ChallengeResponse,
  type EvaluateRequest,
  type EvaluateResponse,
  type HealthResponse,
  type MemoryRestoreRequest,
  type MemoryRestoreResponse,
  type MemorySearchRequest,
  type MemorySearchResponse,
  type OnboardingRequest,
  type OnboardingResponse,
  type RecallRequest,
  type RecallResponse,
} from "../../shared/schema";
import { API_BASE } from "../constants";
import type { ZodType } from "zod";

async function post<TReq, TRes>(
  path: string,
  body: TReq,
  schema: ZodType<TRes>,
): Promise<TRes> {
  const res = await fetch(`${API_BASE}/api${path}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  const json = await res.json().catch(() => null);
  if (!res.ok) {
    const message =
      (json && (json.error as string)) || `Request failed (${res.status})`;
    throw new Error(message);
  }
  const parsed = schema.safeParse(json);
  if (!parsed.success) {
    throw new Error("Unexpected response shape from server");
  }
  return parsed.data;
}

async function get<TRes>(path: string, schema: ZodType<TRes>): Promise<TRes> {
  const res = await fetch(`${API_BASE}/api${path}`);
  const json = await res.json().catch(() => null);
  if (!res.ok) {
    const message =
      (json && (json.error as string)) || `Request failed (${res.status})`;
    throw new Error(message);
  }
  const parsed = schema.safeParse(json);
  if (!parsed.success) {
    throw new Error("Unexpected response shape from server");
  }
  return parsed.data;
}

export const api = {
  health: () => get<HealthResponse>("/health", HealthResponseSchema),

  onboarding: (req: OnboardingRequest) =>
    post<OnboardingRequest, OnboardingResponse>(
      "/onboarding",
      req,
      OnboardingResponseSchema,
    ),

  recall: (req: RecallRequest) =>
    post<RecallRequest, RecallResponse>(
      "/mentor/recall",
      req,
      RecallResponseSchema,
    ),

  generateChallenge: (req: ChallengeRequest) =>
    post<ChallengeRequest, ChallengeResponse>(
      "/challenge/generate",
      req,
      ChallengeResponseSchema,
    ),

  evaluate: (req: EvaluateRequest) =>
    post<EvaluateRequest, EvaluateResponse>(
      "/evaluate",
      req,
      EvaluateResponseSchema,
    ),

  memorySearch: (req: MemorySearchRequest) =>
    post<MemorySearchRequest, MemorySearchResponse>(
      "/memory/search",
      req,
      MemorySearchResponseSchema,
    ),

  memoryRestore: (req: MemoryRestoreRequest) =>
    post<MemoryRestoreRequest, MemoryRestoreResponse>(
      "/memory/restore",
      req,
      MemoryRestoreResponseSchema,
    ),
};
