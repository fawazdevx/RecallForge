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
import { activeEngine, env } from "./env.js";
import { getAgentMemory } from "./memory/agentMemory";
import { agentsRouter } from "./routes/agents";
import { memoryRouter } from "./routes/memory";
import { walrusRouter } from "./routes/walrus";
import { getWalrus } from "./walrus/walrus";

const app = express();

// Allowed browser origins (comma-separated in CLIENT_ORIGIN). Requests with no
// Origin header (curl, server-to-server, health checks) are always allowed.
const allowedOrigins = env.CLIENT_ORIGIN.split(",")
  .map((s) => s.trim())
  .filter(Boolean);

// --- Security & parsing middleware ---
app.disable("x-powered-by");
app.use(helmet());
app.use(
  cors({
    origin(origin, cb) {
      if (!origin || allowedOrigins.includes(origin)) return cb(null, true);
      cb(new Error(`Origin ${origin} not allowed by CORS`));
    },
    methods: ["GET", "POST"],
  }),
);

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
app.use("/api/memory", memoryRouter);
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

// On Vercel (serverless) the platform invokes the exported app directly — only
// bind a port when running as a normal long-lived process (local dev, Railway…).
if (!process.env.VERCEL) {
  app.listen(env.PORT, () => {
    console.log(`\n🔥 RecallForge API on http://localhost:${env.PORT}`);
    console.log(`   agent engine : ${activeEngine}`);
    console.log(`   walrus mode  : ${getWalrus().mode}`);
    console.log(`   memwal       : ${getAgentMemory().enabled ? "on (semantic recall)" : "off (chronological)"}`);
    console.log(`   cors origins : ${allowedOrigins.join(", ")}\n`);
  });
}

// Default export = the Express app, used as the handler on Vercel serverless.
export default app;
