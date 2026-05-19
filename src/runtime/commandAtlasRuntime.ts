import { loadCatalog } from "../catalog/loadCatalog.js";
import { normalizeRegistrations } from "../catalog/normalizeRegistrations.js";
import { loadConfig } from "../config/loadConfig.js";
import { searchCommands } from "../search/rankCommands.js";
import type {
  CommandAtlasConfig,
  CommandRegistration,
  CommandExecutionContext,
  ExecuteBatchResponse,
  ExecuteCommandRequest,
  ExecuteError,
  ExecuteReportEntry,
  LoadedCommand,
  SearchResponse
} from "../types.js";

export class CommandAtlasRuntime {
  readonly config: CommandAtlasConfig;
  readonly commands: LoadedCommand[];
  readonly configPath: string;

  private readonly commandsById: Map<string, LoadedCommand>;
  private readonly namespaceIds: Set<string>;
  private readonly namespaceState = new Map<string, unknown>();

  private constructor(configPath: string, config: CommandAtlasConfig, commands: LoadedCommand[]) {
    this.configPath = configPath;
    this.config = config;
    this.commands = commands;
    this.commandsById = new Map(commands.map((loadedCommand) => [loadedCommand.command.id, loadedCommand]));
    this.namespaceIds = new Set(config.namespaces.map((namespace) => namespace.id));
  }

  static async create(configPath?: string): Promise<CommandAtlasRuntime> {
    const loadedConfig = await loadConfig(configPath);
    const loadedCatalog = await loadCatalog(loadedConfig.config, loadedConfig.configPath);

    return new CommandAtlasRuntime(loadedConfig.configPath, loadedCatalog.config, loadedCatalog.commands);
  }

  static fromRegistrations(
    config: CommandAtlasConfig,
    registrations: CommandRegistration[],
    options: { configPath?: string } = {}
  ): CommandAtlasRuntime {
    const commands = normalizeRegistrations(config, registrations);
    return new CommandAtlasRuntime(options.configPath ?? "<in-memory>", config, commands);
  }

  search(query: string, limit?: number, namespace?: string): SearchResponse {
    this.assertNamespaceIfProvided(namespace);

    const effectiveLimit = clampLimit(limit, this.config.catalog.defaultLimit, this.config.catalog.maxResults);
    return searchCommands(this.commands, {
      query,
      namespace,
      limit: effectiveLimit
    });
  }

  async execute(commands: ExecuteCommandRequest[], continueOnError = false): Promise<ExecuteBatchResponse> {
    const report: ExecuteReportEntry[] = [];

    for (const request of commands) {
      const loadedCommand = this.commandsById.get(request.commandId);
      if (!loadedCommand) {
        report.push({
          commandId: request.commandId,
          ok: false,
          error: createError("COMMAND_NOT_FOUND", `Unknown command id: ${request.commandId}`)
        });

        if (!continueOnError) {
          break;
        }

        continue;
      }

      const parseResult = loadedCommand.command.inputSchema?.safeParse(request.input);
      if (parseResult && !parseResult.success) {
        report.push({
          commandId: request.commandId,
          namespace: loadedCommand.namespace,
          ok: false,
          error: createError(
            "INVALID_INPUT",
            parseResult.error.issues.map((issue) => issue.message).join("; ") || "Input validation failed"
          )
        });

        if (!continueOnError) {
          break;
        }

        continue;
      }

      try {
        const result = await loadedCommand.command.run(parseResult ? parseResult.data : request.input, this.createExecutionContext());
        report.push({
          commandId: request.commandId,
          namespace: loadedCommand.namespace,
          ok: true,
          result
        });
      } catch (error: unknown) {
        report.push({
          commandId: request.commandId,
          namespace: loadedCommand.namespace,
          ok: false,
          error: createError("EXECUTION_FAILED", toErrorMessage(error))
        });

        if (!continueOnError) {
          break;
        }
      }
    }

    return {
      ok: report.every((entry) => entry.ok),
      continueOnError,
      halted: report.length < commands.length,
      totalRequested: commands.length,
      completed: report.length,
      report
    };
  }

  private createExecutionContext(): CommandExecutionContext {
    return {
      config: this.config,
      getNamespaceState: <T>(namespace: string, createInitialState: () => T): T => {
        if (!this.namespaceState.has(namespace)) {
          this.namespaceState.set(namespace, createInitialState());
        }

        return this.namespaceState.get(namespace) as T;
      }
    };
  }

  private assertNamespaceIfProvided(namespace?: string): void {
    if (!namespace) {
      return;
    }

    if (!this.namespaceIds.has(namespace)) {
      throw new Error(`Unknown namespace: ${namespace}`);
    }
  }
}

function clampLimit(limit: number | undefined, fallback: number, max: number): number {
  const requestedLimit = limit ?? fallback;
  return Math.max(1, Math.min(requestedLimit, max));
}

function createError(code: ExecuteError["code"], message: string): ExecuteError {
  return {
    code,
    message
  };
}

function toErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  return String(error);
}