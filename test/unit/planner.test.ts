import { resolve } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { callPlanner } from "../../src/planner/callPlanner.js";
import { createPlanHandler } from "../../src/tools/plan.js";
import type { CommandAtlasConfig, LoadedCommand, PlannerConfig } from "../../src/types.js";
import { CommandAtlasRuntime } from "../../src/runtime/commandAtlasRuntime.js";
import { loadConfig } from "../../src/config/loadConfig.js";

const repoRoot = resolve(__dirname, "..", "..");
const configPath = resolve(repoRoot, "command-atlas.config.json");

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeCommands(): LoadedCommand[] {
  return [
    {
      namespace: "demo",
      namespaceTitle: "Demo",
      sourcePath: "demo/do_request.js",
      searchableText: "do request http",
      command: {
        id: "demo.do_request",
        title: "Do Request",
        summary: "Send an HTTP request.",
        description: "Sends an HTTP request to the given URL.",
        run: async () => ({})
      }
    },
    {
      namespace: "demo",
      namespaceTitle: "Demo",
      sourcePath: "demo/analyze.js",
      searchableText: "analyze response",
      command: {
        id: "demo.analyze",
        title: "Analyze",
        summary: "Analyze the response data.",
        description: "Parses and summarizes a response payload.",
        run: async () => ({})
      }
    }
  ];
}

function mockFetch(body: unknown, ok = true, status = 200) {
  return vi.fn().mockResolvedValue({
    ok,
    status,
    text: async () => JSON.stringify(body),
    json: async () => body
  });
}

// ---------------------------------------------------------------------------
// callPlanner — provider routing
// ---------------------------------------------------------------------------

describe("callPlanner", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("calls Anthropic messages API and parses a sequential plan", async () => {
    const payload = {
      content: [{ type: "text", text: JSON.stringify({ steps: ["demo.do_request", "demo.analyze"], rationale: "sequential" }) }]
    };
    vi.stubGlobal("fetch", mockFetch(payload));

    const cfg: PlannerConfig = { enabled: true, provider: "anthropic", apiKey: "test-key" };
    const result = await callPlanner(cfg, "make a request and analyze", makeCommands());

    expect(result.steps).toEqual(["demo.do_request", "demo.analyze"]);
    expect(result.rationale).toBe("sequential");
    expect(result.intent).toBe("make a request and analyze");

    const [url, init] = (fetch as ReturnType<typeof vi.fn>).mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://api.anthropic.com/v1/messages");
    expect((init.headers as Record<string, string>)["x-api-key"]).toBe("test-key");
  });

  it("calls OpenAI chat completions API", async () => {
    const payload = {
      choices: [{ message: { content: JSON.stringify({ steps: [["demo.do_request", "demo.analyze"]] }) } }]
    };
    vi.stubGlobal("fetch", mockFetch(payload));

    const cfg: PlannerConfig = { enabled: true, provider: "openai", apiKey: "sk-test" };
    const result = await callPlanner(cfg, "parallel run", makeCommands());

    expect(result.steps).toEqual([["demo.do_request", "demo.analyze"]]);

    const [url] = (fetch as ReturnType<typeof vi.fn>).mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://api.openai.com/v1/chat/completions");
  });

  it("calls OpenRouter with correct base URL and headers", async () => {
    const payload = {
      choices: [{ message: { content: JSON.stringify({ steps: ["demo.do_request"] }) } }]
    };
    vi.stubGlobal("fetch", mockFetch(payload));

    const cfg: PlannerConfig = { enabled: true, provider: "openrouter", apiKey: "or-key" };
    await callPlanner(cfg, "just request", makeCommands());

    const [url, init] = (fetch as ReturnType<typeof vi.fn>).mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://openrouter.ai/api/v1/chat/completions");
    expect((init.headers as Record<string, string>)["HTTP-Referer"]).toBeDefined();
  });

  it("calls Gemini generateContent API", async () => {
    const payload = {
      candidates: [{ content: { parts: [{ text: JSON.stringify({ steps: ["demo.analyze"] }) }] } }]
    };
    vi.stubGlobal("fetch", mockFetch(payload));

    const cfg: PlannerConfig = { enabled: true, provider: "gemini", apiKey: "gem-key" };
    const result = await callPlanner(cfg, "just analyze", makeCommands());

    expect(result.steps).toEqual(["demo.analyze"]);

    const [url] = (fetch as ReturnType<typeof vi.fn>).mock.calls[0] as [string, RequestInit];
    expect(url).toContain("generativelanguage.googleapis.com");
  });

  it("resolves api key from environment variable", async () => {
    const payload = {
      content: [{ type: "text", text: JSON.stringify({ steps: ["demo.do_request"] }) }]
    };
    vi.stubGlobal("fetch", mockFetch(payload));
    vi.stubEnv("ANTHROPIC_API_KEY", "env-key");

    const cfg: PlannerConfig = { enabled: true, provider: "anthropic" };
    await callPlanner(cfg, "request", makeCommands());

    const [, init] = (fetch as ReturnType<typeof vi.fn>).mock.calls[0] as [string, RequestInit];
    expect((init.headers as Record<string, string>)["x-api-key"]).toBe("env-key");
  });

  it("throws when no api key is available", async () => {
    vi.stubEnv("ANTHROPIC_API_KEY", "");
    const cfg: PlannerConfig = { enabled: true, provider: "anthropic" };
    await expect(callPlanner(cfg, "intent", makeCommands())).rejects.toThrow(/API key/);
  });

  it("strips markdown code fences from model output", async () => {
    const raw = "```json\n" + JSON.stringify({ steps: ["demo.do_request"] }) + "\n```";
    const payload = {
      content: [{ type: "text", text: raw }]
    };
    vi.stubGlobal("fetch", mockFetch(payload));

    const cfg: PlannerConfig = { enabled: true, provider: "anthropic", apiKey: "key" };
    const result = await callPlanner(cfg, "intent", makeCommands());
    expect(result.steps).toEqual(["demo.do_request"]);
  });

  it("throws on API error response", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: false, status: 401, text: async () => "Unauthorized" })
    );

    const cfg: PlannerConfig = { enabled: true, provider: "anthropic", apiKey: "bad" };
    await expect(callPlanner(cfg, "intent", makeCommands())).rejects.toThrow("401");
  });
});

// ---------------------------------------------------------------------------
// createPlanHandler — MCP tool response shape
// ---------------------------------------------------------------------------

describe("createPlanHandler", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns structured content and formatted text", async () => {
    const payload = {
      content: [{ type: "text", text: JSON.stringify({ steps: ["demo.do_request", "demo.analyze"], rationale: "two steps" }) }]
    };
    vi.stubGlobal("fetch", mockFetch(payload));

    const config: CommandAtlasConfig = {
      version: 1,
      catalog: { defaultLimit: 5, maxResults: 10 },
      planner: { enabled: true, provider: "anthropic", apiKey: "key" },
      namespaces: [{ id: "demo", title: "Demo", root: "./demo" }]
    };

    const runtime = CommandAtlasRuntime.fromRegistrations(config, []);
    const handler = createPlanHandler(runtime);
    const result = await handler({ intent: "make a request and analyze" });

    expect(result.structuredContent).toMatchObject({
      intent: "make a request and analyze",
      steps: ["demo.do_request", "demo.analyze"]
    });
    expect(result.content[0]?.type).toBe("text");
    expect(result.content[0]?.text).toContain("demo.do_request");
    expect(result.content[0]?.text).toContain("demo.analyze");
  });

  it("throws when planner is not configured", async () => {
    const config: CommandAtlasConfig = {
      version: 1,
      catalog: { defaultLimit: 5, maxResults: 10 },
      namespaces: [{ id: "demo", title: "Demo", root: "./demo" }]
    };

    const runtime = CommandAtlasRuntime.fromRegistrations(config, []);
    const handler = createPlanHandler(runtime);
    await expect(handler({ intent: "anything" })).rejects.toThrow("not configured");
  });

  it("throws when planner is disabled", async () => {
    const config: CommandAtlasConfig = {
      version: 1,
      catalog: { defaultLimit: 5, maxResults: 10 },
      planner: { enabled: false, provider: "anthropic", apiKey: "key" },
      namespaces: [{ id: "demo", title: "Demo", root: "./demo" }]
    };

    const runtime = CommandAtlasRuntime.fromRegistrations(config, []);
    const handler = createPlanHandler(runtime);
    await expect(handler({ intent: "anything" })).rejects.toThrow("not configured");
  });

  it("formats parallel steps with [parallel] label", async () => {
    const payload = {
      content: [{ type: "text", text: JSON.stringify({ steps: [["demo.do_request", "demo.analyze"]] }) }]
    };
    vi.stubGlobal("fetch", mockFetch(payload));

    const config: CommandAtlasConfig = {
      version: 1,
      catalog: { defaultLimit: 5, maxResults: 10 },
      planner: { enabled: true, provider: "anthropic", apiKey: "key" },
      namespaces: [{ id: "demo", title: "Demo", root: "./demo" }]
    };

    const runtime = CommandAtlasRuntime.fromRegistrations(config, []);
    const handler = createPlanHandler(runtime);
    const result = await handler({ intent: "parallel" });

    expect(result.content[0]?.text).toContain("[parallel]");
    expect(result.content[0]?.text).toContain("demo.do_request");
  });
});

// ---------------------------------------------------------------------------
// Config — planner section loading
// ---------------------------------------------------------------------------

describe("loadConfig — planner", () => {
  it("loads planner config from the default config file with enabled=false", async () => {
    const { config } = await loadConfig(configPath);
    expect(config.planner).toBeDefined();
    expect(config.planner?.enabled).toBe(false);
  });
});
