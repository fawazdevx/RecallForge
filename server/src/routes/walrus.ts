/**
 * Walrus read route — proxies a stored memory artifact back to the client so
 * the UI can render the raw on-Walrus JSON (the "artifact viewer").
 */
import { Router } from "express";
import { z } from "zod";
import { asyncHandler } from "../middleware/asyncHandler";
import { getWalrus } from "../walrus/walrus";

export const walrusRouter = Router();

// Accept real Walrus blob ids (base64url-ish) and our local: fallback ids.
const BlobIdSchema = z
  .string()
  .min(1)
  .max(300)
  .regex(/^(local:)?[A-Za-z0-9_-]+$/, "invalid blob id");

walrusRouter.get(
  "/:blobId",
  asyncHandler(async (req, res) => {
    const parsed = BlobIdSchema.safeParse(req.params.blobId);
    if (!parsed.success) {
      res.status(400).json({ error: "Invalid blob id" });
      return;
    }
    try {
      const data = await getWalrus().read(parsed.data);
      res.json({ blobId: parsed.data, data });
    } catch (err) {
      res.status(404).json({
        error: "Blob not found or unreadable",
        detail: (err as Error).message,
      });
    }
  }),
);
