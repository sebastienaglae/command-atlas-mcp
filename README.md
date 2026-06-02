# Command Atlas MCP

Command Atlas MCP is a public TypeScript MCP server framework for APIs and automation surfaces that would otherwise expose dozens or hundreds of tools.

Instead of declaring every command as a native MCP tool, Command Atlas exposes a compact surface:

- `search`: wide search across the full catalog
- `execute`: execute one or more catalog commands sequentially

By default, that means exactly two MCP tools: `search` and `execute`.

If you want an explicit namespace helper for agents or clients that benefit from it, you can opt in to a third convenience tool:

- `search_namespace`: focused search inside one namespace

When you need to skip the search step entirely, enable the optional AI planner:

- `plan`: describe your intent in plain language — a light AI model selects and sequences the right commands for you, returning an ordered plan ready to pass directly to `execute`

This keeps the MCP surface small while still letting an agent discover the right command and then run it.

## Why this exists

Traditional MCP servers become clanky when they expose very large tool catalogs. Tool selection gets noisy, context costs rise, and maintenance gets worse as each new command has to be declared at the MCP layer.

Command Atlas keeps MCP widely compatible with IDEs and agents, but shifts scale into a searchable command catalog. The agent workflow becomes:

1. `search` for a command across the catalog.
2. Optionally `search_namespace` when the domain is already known and that helper is enabled.
3. `execute` the chosen command id, or a batch of command ids.

## Features

- Public MCP surface limited to two tools by default, or three when the namespace helper is enabled.
- Optional AI planner tool — describe intent in plain language, get back a sequenced plan of command ids.
- Multi-provider AI support: Anthropic, OpenAI, OpenRouter, Google Gemini.
- Parallel step groups — the planner can mark independent commands to run concurrently.
- Namespace-aware command discovery.
- Deterministic ranking for wide search.
- Strict input validation per command using Zod.
- Sequential batch execution with per-command reporting.
- Stdio transport using `@modelcontextprotocol/sdk` v1.
- Unit and stdio integration tests.

## Project layout

```text
.
├── commands/
│   └── demo/
│       ├── basic/
├── examples/
│   ├── blender/
│   │   ├── command-atlas.config.json
│   │   └── commands/assets/
│   ├── legacy-registry-bridge.ts
│   └── unity/
│       ├── command-atlas.config.json
│       └── commands/scene/
├── src/
│   ├── catalog/
│   ├── config/
│   ├── planner/
│   ├── runtime/
│   ├── search/
│   └── tools/
├── test/
│   ├── integration/
│   └── unit/
├── command-atlas.config.json
└── .vscode/mcp.json
```

## Quick start

### 1. Install dependencies

```bash
npm install
```

### 2. Run validation

```bash
npm run validate
```

### 3. Start the MCP server

```bash
npm run build
npm run start
```

You can also start the published CLI directly with runtime options:

```bash
command-atlas-mcp --config ./command-atlas.config.json
command-atlas-mcp --config ./command-atlas.config.json --expose-search-namespace
command-atlas-mcp --version
```

During development, use:

```bash
npm run dev
```

## Configuration

The default config file is `./command-atlas.config.json`.

```json
{
  "version": 1,
  "catalog": {
    "defaultLimit": 6,
    "maxResults": 20
  },
  "surface": {
    "exposeSearchNamespaceTool": false
  },
  "planner": {
    "enabled": false,
    "provider": "anthropic",
    "model": "claude-haiku-4-5-20251001",
    "apiKeyEnvVar": "ANTHROPIC_API_KEY"
  },
  "namespaces": [
    {
      "id": "demo",
      "title": "Demo Commands",
      "root": "./commands/demo/basic"
    }
  ]
}
```

Each namespace points to a directory containing command modules. The default starter uses a neutral `demo` namespace so the repo is easy to reuse. Unity and Blender are shipped only as optional examples under `examples/unity` and `examples/blender`, each with its own config and command folder. At runtime, Command Atlas resolves the source directory in development and the compiled mirror under `dist/` in production.

Set `surface.exposeSearchNamespaceTool` to `true` when you want to publish `search_namespace` as a third MCP tool. If it stays `false`, namespace filtering is still available through the `namespace` field on `search`.

The CLI can override config at launch time:

- `--config <path>` loads a specific config file.
- `--expose-search-namespace` forces the helper tool on.
- `--hide-search-namespace` forces a two-tool surface even if config enables it.
- `--version` prints the current Command Atlas MCP version.

If you already have a large MCP or tool registry in memory, you can skip filesystem discovery and create a runtime programmatically.

## Starter examples

- Default starter: `./command-atlas.config.json` uses simple generic commands under `./commands/demo/basic`.
- Unity example: `./examples/unity/command-atlas.config.json` points to `./examples/unity/commands/scene`.
- Blender example: `./examples/blender/command-atlas.config.json` points to `./examples/blender/commands/assets`.

See `./examples/README.md` for a quick index of optional example setups.

## Writing commands

Each command module exports a `command` definition. Metadata is indexed by `search`; execution is handled by `run`.

```ts
import { z } from "zod";
import type { CommandDefinition } from "command-atlas-mcp";

const inputSchema = z.object({
  name: z.string().min(1)
});

export const command: CommandDefinition<z.infer<typeof inputSchema>, { ok: true }> = {
  id: "scene.rename_object",
  title: "Rename Scene Object",
  summary: "Rename an object in the scene.",
  description: "Updates an existing object name in the scene state.",
  tags: ["scene", "rename"],
  aliases: ["rename object"],
  examples: ["Rename CameraRig to GameplayCamera"],
  inputHint: '{ "name": "GameplayCamera" }',
  outputHint: '{ "ok": true }',
  inputSchema,
  async run(input, context) {
    const state = context.getNamespaceState("scene", () => ({ objects: [] }));
    void state;
    return { ok: true };
  }
};
```

You can also define commands programmatically and plug them into an existing MCP-oriented codebase:

```ts
import { z } from "zod";
import { CommandAtlasRuntime, createServer, defineCommand } from "command-atlas-mcp";

const runtime = CommandAtlasRuntime.fromRegistrations(
  {
    version: 1,
    catalog: { defaultLimit: 5, maxResults: 20 },
    namespaces: [{ id: "scene", title: "Scene Commands", root: "./scene" }]
  },
  [
    {
      namespace: "scene",
      command: defineCommand({
        id: "scene.rename_object",
        title: "Rename Scene Object",
        summary: "Rename an object in the scene.",
        description: "Updates object state from an existing tool backend.",
        inputSchema: z.object({ name: z.string().min(1) }),
        async run(input) {
          return { renamedTo: input.name };
        }
      })
    }
  ]
);

const server = await createServer({ runtime });
```

If you already have a registry of handlers from an older MCP implementation, you can adapt it directly instead of rewriting every command:

```ts
import { z } from "zod";
import { adaptCommandRegistry, CommandAtlasRuntime } from "command-atlas-mcp";

const legacySceneRegistry = {
  rename_object: {
    title: "Rename Scene Object",
    summary: "Rename an object in the scene.",
    description: "Bridges an existing handler registry into Command Atlas.",
    inputSchema: z.object({ name: z.string().min(1) }),
    async execute(input: { name: string }) {
      return { renamedTo: input.name };
    }
  }
};

const registrations = adaptCommandRegistry("scene", legacySceneRegistry, {
  sourcePathPrefix: "legacy-scene-registry"
});

const runtime = CommandAtlasRuntime.fromRegistrations(config, registrations);
```

This is the migration path for large MCPs that already have command handlers but want to expose only search and execute at the MCP boundary.

## AI Planner

The planner is an optional fourth tool that replaces the search-then-execute round-trip with a single AI call. A light model reads your intent and the full command catalog, then returns an ordered plan.

### Enabling the planner

Set `planner.enabled` to `true` in your config and choose a provider:

```json
"planner": {
  "enabled": true,
  "provider": "anthropic",
  "model": "claude-haiku-4-5-20251001",
  "apiKeyEnvVar": "ANTHROPIC_API_KEY"
}
```

Set `"enabled": false` to disable the `plan` MCP tool without removing the config block.

### Supported providers

| `provider` | Default model | Default env var |
|---|---|---|
| `anthropic` | `claude-haiku-4-5-20251001` | `ANTHROPIC_API_KEY` |
| `openai` | `gpt-4o-mini` | `OPENAI_API_KEY` |
| `openrouter` | `openai/gpt-4o-mini` | `OPENROUTER_API_KEY` |
| `gemini` | `gemini-2.0-flash-lite` | `GEMINI_API_KEY` |

You can override any model via the `model` field and any base URL via `baseUrl` (useful for OpenRouter or local proxies).

### Plan output

Steps is an ordered array where each element is either a **single command id** (run sequentially) or an **array of command ids** (run in parallel):

```json
{
  "intent": "make a request and analyze",
  "steps": [
    "demo.do_request",
    ["demo.parse_response", "demo.log_response"],
    "demo.analyze"
  ],
  "rationale": "request must complete first; parse and log are independent; analyze needs both"
}
```

Pass the steps directly to `execute` after stripping the parallel groups (or run the parallel groups concurrently yourself).

## Tool contract

### `search`

Wide search across the entire command catalog.

Input:

```json
{
  "query": "import texture asset",
  "limit": 5,
  "namespace": "assets"
}
```

### `search_namespace`

This tool is optional and only exposed when `surface.exposeSearchNamespaceTool` is enabled.

Namespace-constrained search.

Input:

```json
{
  "namespace": "scene",
  "query": "create sphere",
  "limit": 5
}
```

### `execute`

Sequential execution of one or more selected commands.

Input:

```json
{
  "commands": [
    {
      "commandId": "scene.create_object",
      "input": {
        "name": "PlayerSpawn",
        "template": "sphere"
      }
    },
    {
      "commandId": "scene.list_objects"
    }
  ],
  "continueOnError": false
}
```

### `plan`

This tool is optional and only exposed when `planner.enabled` is `true`.

AI-powered command selection and sequencing.

Input:

```json
{
  "intent": "make a request and analyze the response"
}
```

Output:

```json
{
  "intent": "make a request and analyze the response",
  "steps": ["demo.do_request", "demo.analyze"],
  "rationale": "request must complete before analysis"
}
```

## Design notes

- The public surface stays small even when the catalog grows.
- Namespaces are logical groupings, not separate MCP servers.
- `search_namespace` is an optional convenience layer over the same index as `search`.
- `execute` validates each command input before dispatching the handler.
- Batch execution is sequential and reports each step.

## VS Code MCP configuration

An example VS Code MCP config is included in [.vscode/mcp.json](.vscode/mcp.json).

For a programmatic migration example, see [examples/legacy-registry-bridge.ts](examples/legacy-registry-bridge.ts).

## Validation

The default validation workflow is:

```bash
npm run typecheck
npm test
npm run build
```

Or in one command:

```bash
npm run validate
```

## Status

This repository currently ships a working reference implementation with demo namespaces for scene and asset workflows. It is designed as a base for larger domain-specific MCP catalogs such as game engines, DCC tooling, and creative pipelines.