export interface ParsedCliArgs {
  configPath?: string;
  exposeNamespaceTool?: boolean;
  showHelp?: boolean;
  showVersion?: boolean;
}

export function parseCliArgs(argv: string[]): ParsedCliArgs {
  const parsedArgs: ParsedCliArgs = {};

  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];

    if (argument === "--config") {
      const value = argv[index + 1];
      if (!value || value.startsWith("--")) {
        throw new Error("Missing value for --config");
      }

      parsedArgs.configPath = value;
      index += 1;
      continue;
    }

    if (argument === "--expose-search-namespace") {
      parsedArgs.exposeNamespaceTool = true;
      continue;
    }

    if (argument === "--hide-search-namespace") {
      parsedArgs.exposeNamespaceTool = false;
      continue;
    }

    if (argument === "--help") {
      parsedArgs.showHelp = true;
      continue;
    }

    if (argument === "--version") {
      parsedArgs.showVersion = true;
      continue;
    }

    throw new Error(`Unknown argument: ${argument}`);
  }

  return parsedArgs;
}

export function getCliHelpText(): string {
  return [
    "Command Atlas MCP",
    "Usage: command-atlas-mcp [--config <path>] [--expose-search-namespace] [--hide-search-namespace] [--version]",
    "",
    "Options:",
    "  --config <path>               Load a specific command-atlas.config.json file.",
    "  --expose-search-namespace     Publish search_namespace as a third MCP tool.",
    "  --hide-search-namespace       Force a two-tool public surface even if config enables the helper.",
    "  --version                     Print the Command Atlas MCP version.",
    "  --help                        Print this help text."
  ].join("\n");
}