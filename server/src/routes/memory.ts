
import { Router } from "express";
import {
  MemoryRestoreRequestSchema,
  MemorySearchRequestSchema,
  type MemoryRestoreRequest,
  type MemorySearchRequest,
} from "../shared/schema.js";
import { getAgentMemory, nsFor } from "../memory/agentMemory.js";
import { asyncHandler } from "../middleware/asyncHandler.js";
import { rateLimit } from "../middleware/rateLimit.js";
import { body, validateBody } from "../middleware/validate.js";

export const memoryRouter = Router();

const memoryLimiter = rateLimit({ capacity: 30, windowMs: 60_000 });

memoryRouter.post(
  "/search",
  memoryLimiter,
  validateBody(MemorySearchRequestSchema),
  asyncHandler(async (_req, res) => {
    const input = body<MemorySearchRequest>(res);
    const mem = getAgentMemory();
    const namespace = nsFor(input.address, input.handle);
    const results = await mem.recall(input.query, namespace, input.limit);
    res.json({ enabled: mem.enabled, namespace, results });
  }),
);

memoryRouter.post(
  "/restore",
  memoryLimiter,
  validateBody(MemoryRestoreRequestSchema),
  asyncHandler(async (_req, res) => {
    const input = body<MemoryRestoreRequest>(res);
    const mem = getAgentMemory();
    const namespace = nsFor(input.address, input.handle);
    const outcome = await mem.restore(namespace, input.limit);
    res.json({ enabled: mem.enabled, namespace, ...outcome });
  }),
);
