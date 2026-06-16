/**
 * RecallForge backend entrypoint.
 *
 * A small, stateless Express API that (1) runs the 3 learning agents (Claude
 * with a deterministic fallback) and (2) reads/writes learning memory on
 * Walrus. It holds no per-user state and never signs Sui transactions — the
 * user's wallet does that on the client.
 */
import cors from "cors";
import express, { type NextFunction, type Request, type Response } from "express";
import helmet from "helmet";
import { activeEngine, env } from "./env";
import { getAgentMemory } from "./memory/agentMemory";
import { agentsRouter } from "./routes/agents";
import { walrusRouter } from "./routes/walrus";
import { getWalrus } from "./walrus/walrus";

const app = express();

// --- Security & parsing middleware ---
app.disable("x-powered-by");
app.use(helmet());
app.use(
  cors({
    origin: env.CLIENT_ORIGIN,
    methods: ["GET", "POST"],
  }),
);
// Cap body size: learner answers are bounded by the schema, this is belt-and-braces.
app.use(express.json({ limit: "256kb" }));

// --- Health ---
app.get("/api/health", (_req: Request, res: Response) => {
  res.json({
    ok: true,
    engine: activeEngine,
    walrus: getWalrus().mode,
    memwal: getAgentMemory().enabled,
    network: env.SUI_NETWORK,
  });
});

// --- Routes ---
app.use("/api", agentsRouter);
app.use("/api/walrus", walrusRouter);

// --- 404 ---
app.use((_req: Request, res: Response) => {
  res.status(404).json({ error: "Not found" });
});

// --- Central error handler ---
app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
  console.error("Unhandled error:", err);
  if (res.headersSent) return;
  res.status(500).json({ error: "Internal server error" });
});

app.listen(env.PORT, () => {
  console.log(`\n🔥 RecallForge API on http://localhost:${env.PORT}`);
  console.log(`   agent engine : ${activeEngine}`);
  console.log(`   walrus mode  : ${getWalrus().mode}`);
  console.log(`   memwal       : ${getAgentMemory().enabled ? "on (semantic recall)" : "off (chronological)"}`);
  console.log(`   cors origin  : ${env.CLIENT_ORIGIN}\n`);
});
