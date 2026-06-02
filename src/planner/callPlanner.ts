import type { LoadedCommand, PlannerConfig, PlanResponse, PlanStep } from "../types.js";

const DEFAULT_MODELS: Record<string, string> = {
  anthropic: "claude-haiku-4-5-20251001",
  openai: "gpt-4o-mini",
  openrouter: "openai/gpt-4o-mini",
  gemini: "gemini-2.5-flash"
};

const SYSTEM_PROMPT = `You are a tool planner. Given a user's intent and a list of available commands, return a JSON plan.

Output ONLY valid JSON — no markdown, no explanation — in this exact shape:
{
  "steps": [ "tool-id-a", ["tool-id-b", "tool-id-c"] ],
  "rationale": "optional short explanation"
}

Rules:
- Each element of "steps" is either a single command id (string) OR an array of command ids that can run in parallel.
- Only use command ids from the provided catalog. Do not invent ids.
- Keep the plan minimal — include only commands needed to fulfil the intent.`;

function buildUserMessage(intent: string, commands: LoadedCommand[]): string {
  const catalog = commands
    .map((c) => `- ${c.command.id} [${c.namespace}]: ${c.command.summary}`)
    .join("\n");

  return `Intent: ${intent}\n\nAvailable commands:\n${catalog}`;
}

function resolveApiKey(cfg: PlannerConfig): string {
  if (cfg.apiKey) return cfg.apiKey;
  const envVar = cfg.apiKeyEnvVar ?? defaultEnvVar(cfg.provider);
  const key = process.env[envVar];
  if (!key) throw new Error(`Planner API key not found. Set ${envVar} or provide apiKey in config.`);
  return key;
}

function defaultEnvVar(provider: string): string {
  const map: Record<string, string> = {
    anthropic: "ANTHROPIC_API_KEY",
    openai: "OPENAI_API_KEY",
    openrouter: "OPENROUTER_API_KEY",
    gemini: "GEMINI_API_KEY"
  };
  return map[provider] ?? "PLANNER_API_KEY";
}

async function callAnthropicMessages(
  apiKey: string,
  model: string,
  userMessage: string
): Promise<string> {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json"
    },
    body: JSON.stringify({
      model,
      max_tokens: 512,
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: userMessage }]
    })
  });

  if (!res.ok) {
    throw new Error(`Anthropic API error ${res.status}: ${await res.text()}`);
  }

  const data = (await res.json()) as { content: Array<{ type: string; text: string }> };
  return data.content.find((b) => b.type === "text")?.text ?? "";
}

async function callOpenAICompat(
  apiKey: string,
  model: string,
  baseUrl: string,
  userMessage: string,
  extraHeaders: Record<string, string> = {}
): Promise<string> {
  const res = await fetch(`${baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "content-type": "application/json",
      ...extraHeaders
    },
    body: JSON.stringify({
      model,
      max_tokens: 512,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: userMessage }
      ]
    })
  });

  if (!res.ok) {
    throw new Error(`API error ${res.status}: ${await res.text()}`);
  }

  const data = (await res.json()) as {
    choices: Array<{ message: { content: string } }>;
  };
  return data.choices[0]?.message?.content ?? "";
}

async function callGemini(
  apiKey: string,
  model: string,
  userMessage: string
): Promise<string> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      system_instruction: { parts: [{ text: SYSTEM_PROMPT }] },
      contents: [{ parts: [{ text: userMessage }] }]
    })
  });

  if (!res.ok) {
    throw new Error(`Gemini API error ${res.status}: ${await res.text()}`);
  }

  const data = (await res.json()) as {
    candidates: Array<{ content: { parts: Array<{ text: string }> } }>;
  };
  return data.candidates[0]?.content?.parts[0]?.text ?? "";
}

function parseSteps(raw: string): PlanStep[] {
  const cleaned = raw.replace(/```json\s*/g, "").replace(/```\s*/g, "").trim();
  const parsed = JSON.parse(cleaned) as { steps: unknown[] };

  if (!Array.isArray(parsed.steps)) throw new Error("Planner response missing 'steps' array");

  return parsed.steps.map((step) => {
    if (typeof step === "string") return step;
    if (Array.isArray(step) && step.every((s) => typeof s === "string")) return step as string[];
    throw new Error(`Invalid step format: ${JSON.stringify(step)}`);
  });
}

export async function callPlanner(
  cfg: PlannerConfig,
  intent: string,
  commands: LoadedCommand[]
): Promise<PlanResponse> {
  const apiKey = resolveApiKey(cfg);
  const model = cfg.model ?? DEFAULT_MODELS[cfg.provider] ?? "";
  const userMessage = buildUserMessage(intent, commands);

  let raw: string;

  switch (cfg.provider) {
    case "anthropic":
      raw = await callAnthropicMessages(apiKey, model, userMessage);
      break;

    case "openai":
      raw = await callOpenAICompat(apiKey, model, cfg.baseUrl ?? "https://api.openai.com/v1", userMessage);
      break;

    case "openrouter":
      raw = await callOpenAICompat(apiKey, model, cfg.baseUrl ?? "https://openrouter.ai/api/v1", userMessage, {
        "HTTP-Referer": "https://github.com/command-atlas-mcp",
        "X-Title": "Command Atlas MCP Planner"
      });
      break;

    case "gemini":
      raw = await callGemini(apiKey, model, userMessage);
      break;

    default:
      throw new Error(`Unknown planner provider: ${cfg.provider}`);
  }

  const steps = parseSteps(raw);
  const rationale = (() => {
    try {
      const cleaned = raw.replace(/```json\s*/g, "").replace(/```\s*/g, "").trim();
      const parsed = JSON.parse(cleaned) as { rationale?: string };
      return parsed.rationale;
    } catch {
      return undefined;
    }
  })();

  return { intent, steps, rationale };
}
