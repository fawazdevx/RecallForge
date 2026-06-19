
import "dotenv/config";
import { z } from "zod";


const optionalSecret = z.preprocess(
  (v) => (typeof v === "string" && v.trim() === "" ? undefined : v),
  z.string().min(1).optional(),
);

const EnvSchema = z.object({
  PORT: z.coerce.number().int().positive().default(8787),

  CLIENT_ORIGIN: z.string().default("http://localhost:5173"),
  ANTHROPIC_API_KEY: optionalSecret,
  ANTHROPIC_MODEL: z.string().default("claude-sonnet-4-6"),
  // Optional override for an Anthropic-compatible gateway/proxy. When unset the
  // SDK uses Anthropic's default (https://api.anthropic.com).
  ANTHROPIC_BASE_URL: z.preprocess(
    (v) => (typeof v === "string" && v.trim() === "" ? undefined : v),
    z.string().url().optional(),
  ),
  WALRUS_PUBLISHER_URL: z
    .string()
    .url()
    .default("https://publisher.walrus-testnet.walrus.space"),
  WALRUS_AGGREGATOR_URL: z
    .string()
    .url()
    .default("https://aggregator.walrus-testnet.walrus.space"),
  WALRUS_EPOCHS: z.coerce.number().int().positive().max(200).default(5),
  WALRUS_LOCAL: z
    .enum(["0", "1"])
    .default("0")
    .transform((v) => v === "1"),
  SUI_NETWORK: z.string().default("testnet"),

  MEMWAL_ACCOUNT_ID: optionalSecret,
  MEMWAL_DELEGATE_KEY: optionalSecret,
  MEMWAL_SERVER_URL: z.string().url().default("https://relayer.memwal.ai"),
  MEMWAL_NAMESPACE_PREFIX: z.string().min(1).max(64).default("recallforge"),
});

const parsed = EnvSchema.safeParse(process.env);

if (!parsed.success) {
  // Fail fast with a readable message rather than crashing deep in a handler.
  console.error("❌ Invalid backend configuration:");
  console.error(parsed.error.flatten().fieldErrors);
  process.exit(1);
}

export const env = parsed.data;


export const hasLlm = Boolean(env.ANTHROPIC_API_KEY);


export const activeEngine: "claude" | "fallback" = hasLlm ? "claude" : "fallback";


export const hasMemWal = Boolean(
  env.MEMWAL_ACCOUNT_ID && env.MEMWAL_DELEGATE_KEY,
);
