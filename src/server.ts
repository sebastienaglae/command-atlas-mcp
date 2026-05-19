import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { pathToFileURL } from "node:url";
import { z } from "zod";
import { getCliHelpText, parseCliArgs } from "./cli/parseCliArgs.js";
import { COMMAND_ATLAS_SERVER_NAME, COMMAND_ATLAS_SERVER_VERSION } from "./metadata.js";
import { CommandAtlasRuntime } from "./runtime/commandAtlasRuntime.js";
import { createExecuteHandler } from "./tools/execute.js";
import { createSearchHandlers } from "./tools/search.js";

export interface CreateServerOptions {
  configPath?: string;
  runtime?: CommandAtlasRuntime;
  exposeNamespaceTool?: boolean;
}

export async function createServer(options: CreateServerOptions = {}): Promise<McpServer> {
  const runtime = options.runtime ?? (await CommandAtlasRuntime.create(options.configPath));
  const exposeNamespaceTool = options.exposeNamespaceTool ?? runtime.config.surface?.exposeSearchNamespaceTool ?? false;
  const server = new McpServer({
    name: COMMAND_ATLAS_SERVER_NAME,
    version: COMMAND_ATLAS_SERVER_VERSION
  });
  const searchHandlers = createSearchHandlers(runtime);
  const executeHandler = createExecuteHandler(runtime);

  server.registerTool(
    "search",
    {
      description: "Wide search across the full command catalog.",
      inputSchema: z.object({
        query: z.string().min(1),
        limit: z.number().int().min(1).max(25).optional(),
        namespace: z.string().min(1).optional()
      })
    },
    searchHandlers.search
  );

  if (exposeNamespaceTool) {
    server.registerTool(
      "search_namespace",
      {
        description: "Search within a single namespace.",
        inputSchema: z.object({
          namespace: z.string().min(1),
          query: z.string().min(1),
          limit: z.number().int().min(1).max(25).optional()
        })
      },
      searchHandlers.searchNamespace
    );
  }

  server.registerTool(
    "execute",
    {
      description: "Execute one or more commands selected from the catalog.",
      inputSchema: z.object({
        commands: z
          .array(
            z.object({
              commandId: z.string().min(1),
              input: z.unknown().optional()
            })
          )
          .min(1),
        continueOnError: z.boolean().optional()
      })
    },
    executeHandler
  );

  return server;
}

export async function startServer(): Promise<void> {
  const cliOptions = parseCliArgs(process.argv.slice(2));

  if (cliOptions.showHelp) {
    console.error(getCliHelpText());
    return;
  }

  if (cliOptions.showVersion) {
    console.error(COMMAND_ATLAS_SERVER_VERSION);
    return;
  }

  const server = await createServer(cliOptions);
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  startServer().catch((error: unknown) => {
    console.error("Failed to start Command Atlas MCP", error);
    process.exitCode = 1;
  });
}