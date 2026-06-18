
import Anthropic from "@anthropic-ai/sdk";
import type { ZodType } from "zod";
import { env, hasLlm } from "../env.js";

let client: Anthropic | null = null;

function getClient(): Anthropic | null {
  if (!hasLlm) return null;
  if (!client) {
    client = new Anthropic({
      apiKey: env.ANTHROPIC_API_KEY,
      // Route through a compatible gateway when configured (e.g. a proxy key).
      ...(env.ANTHROPIC_BASE_URL ? { baseURL: env.ANTHROPIC_BASE_URL } : {}),
    });
  }
  return client;
}


export async function callClaudeJSON<T>(args: {
  system: string;
  user: string;
  schema: ZodType<T>;
  maxTokens?: number;
}): Promise<T | null> {
  const anthropic = getClient();
  if (!anthropic) return null;

  try {
    const res = await anthropic.messages.create({
      model: env.ANTHROPIC_MODEL,
      max_tokens: args.maxTokens ?? 1500,
      system: [
        {
          type: "text",
          text: args.system,
          cache_control: { type: "ephemeral" },
        },
      ],
      messages: [{ role: "user", content: args.user }],
    });

    const text = res.content
      .filter((b): b is Anthropic.TextBlock => b.type === "text")
      .map((b) => b.text)
      .join("");

    const json = extractJson(text);
    if (json === undefined) {
      console.warn(
        `⚠️  Claude output had no parseable JSON; using fallback.\n` +
          `    raw: ${text.slice(0, 400).replace(/\s+/g, " ")}`,
      );
      return null;
    }

    const parsed = args.schema.safeParse(json);
    if (!parsed.success) {
      console.warn(
        `⚠️  Claude output failed schema validation; using fallback.\n` +
          `    issues: ${JSON.stringify(parsed.error.issues.slice(0, 6))}\n` +
          `    got: ${JSON.stringify(json).slice(0, 400)}`,
      );
      return null;
    }
    return parsed.data;
  } catch (err) {
    console.warn(`⚠️  Claude call failed (${(err as Error).message}); using fallback.`);
    return null;
  }
}


function extractJson(text: string): unknown {
  const trimmed = text.trim();
  
  try {
    return JSON.parse(trimmed);
  } catch {
    
  }
  const start = trimmed.indexOf("{");
  const end = trimmed.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) return undefined;
  try {
    return JSON.parse(trimmed.slice(start, end + 1));
  } catch {
    return undefined;
  }
}
