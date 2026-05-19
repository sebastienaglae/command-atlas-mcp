import { resolve } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

const repoRoot = resolve(__dirname, "..", "..");
const configPath = resolve(repoRoot, "command-atlas.config.json");
const namespaceToolConfigPath = resolve(repoRoot, "test", "fixtures", "namespace-tool", "command-atlas.config.json");

function createStringEnv(overrides: Record<string, string> = {}): Record<string, string> {
  return Object.fromEntries(
    Object.entries({ ...process.env, ...overrides }).filter((entry): entry is [string, string] => typeof entry[1] === "string")
  );
}

describe("Command Atlas MCP stdio", () => {
  let client: Client | undefined;

  afterEach(async () => {
    if (client) {
      await client.close();
      client = undefined;
    }
  });

  it("exposes only search and execute by default", async () => {
    client = new Client({
      name: "command-atlas-test-client",
      version: "0.1.0"
    });

    const transport = new StdioClientTransport({
      command: process.execPath,
      args: ["--import", "tsx", "src/server.ts"],
      cwd: repoRoot,
      env: createStringEnv({ COMMAND_ATLAS_CONFIG_PATH: configPath }),
      stderr: "pipe"
    });

    await client.connect(transport);

    const tools = await client.listTools();
    expect(tools.tools.map((tool) => tool.name).sort()).toEqual(["execute", "search"]);

    const searchResult = await client.callTool({
      name: "search",
      arguments: {
        query: "add item"
      }
    });

    expect(searchResult.structuredContent).toMatchObject({
      query: "add item"
    });

    const executeResult = await client.callTool({
      name: "execute",
      arguments: {
        commands: [
          {
            commandId: "demo.add_item",
            input: {
              label: "Alpha"
            }
          },
          {
            commandId: "demo.list_items"
          }
        ]
      }
    });

    expect(executeResult.structuredContent).toMatchObject({
      ok: true,
      report: [
        {
          commandId: "demo.add_item",
          ok: true
        },
        {
          commandId: "demo.list_items",
          ok: true
        }
      ]
    });
  });

  it("can opt in to search_namespace as a third public tool", async () => {
    client = new Client({
      name: "command-atlas-test-client",
      version: "0.1.0"
    });

    const transport = new StdioClientTransport({
      command: process.execPath,
      args: ["--import", "tsx", "src/server.ts", "--config", namespaceToolConfigPath],
      cwd: repoRoot,
      env: createStringEnv(),
      stderr: "pipe"
    });

    await client.connect(transport);

    const tools = await client.listTools();
    expect(tools.tools.map((tool) => tool.name).sort()).toEqual(["execute", "search", "search_namespace"]);

    const namespaceSearchResult = await client.callTool({
      name: "search_namespace",
      arguments: {
        namespace: "demo",
        query: "list items"
      }
    });

    expect(namespaceSearchResult.structuredContent).toMatchObject({
      namespace: "demo",
      query: "list items"
    });
  });

  it("can disable search_namespace from the CLI even when config enables it", async () => {
    client = new Client({
      name: "command-atlas-test-client",
      version: "0.1.0"
    });

    const transport = new StdioClientTransport({
      command: process.execPath,
      args: [
        "--import",
        "tsx",
        "src/server.ts",
        "--config",
        namespaceToolConfigPath,
        "--hide-search-namespace"
      ],
      cwd: repoRoot,
      env: createStringEnv(),
      stderr: "pipe"
    });

    await client.connect(transport);

    const tools = await client.listTools();
    expect(tools.tools.map((tool) => tool.name).sort()).toEqual(["execute", "search"]);
  });
});