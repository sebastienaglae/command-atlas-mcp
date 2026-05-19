import type { ZodTypeAny } from "zod";

export interface CommandAtlasNamespaceConfig {
  id: string;
  title: string;
  description?: string;
  root: string;
}

export interface CommandAtlasConfig {
  version: 1;
  catalog: {
    defaultLimit: number;
    maxResults: number;
  };
  surface?: {
    exposeSearchNamespaceTool?: boolean;
  };
  namespaces: CommandAtlasNamespaceConfig[];
}

export interface CommandExecutionContext {
  config: CommandAtlasConfig;
  getNamespaceState<T>(namespace: string, createInitialState: () => T): T;
}

export interface CommandDefinition<TInput = unknown, TOutput = unknown> {
  id: string;
  namespace?: string;
  title: string;
  summary: string;
  description: string;
  tags?: string[];
  aliases?: string[];
  examples?: string[];
  inputHint?: string;
  outputHint?: string;
  inputSchema?: ZodTypeAny;
  run: (input: TInput, context: CommandExecutionContext) => Promise<TOutput> | TOutput;
}

export type AnyCommandDefinition = CommandDefinition<any, any>;

export interface LegacyCommandDescriptor<TInput = unknown, TOutput = unknown> {
  id?: string;
  title: string;
  summary: string;
  description: string;
  tags?: string[];
  aliases?: string[];
  examples?: string[];
  inputHint?: string;
  outputHint?: string;
  inputSchema?: ZodTypeAny;
  execute: (input: TInput, context: CommandExecutionContext) => Promise<TOutput> | TOutput;
}

export type AnyLegacyCommandDescriptor = LegacyCommandDescriptor<any, any>;

export interface CommandRegistration {
  namespace: string;
  command: AnyCommandDefinition;
  sourcePath?: string;
}

export interface LoadedCommand {
  command: AnyCommandDefinition;
  namespace: string;
  namespaceTitle: string;
  sourcePath: string;
  searchableText: string;
}

export interface SearchResult extends Record<string, unknown> {
  id: string;
  namespace: string;
  title: string;
  summary: string;
  description: string;
  score: number;
  tags: string[];
  aliases: string[];
  examples: string[];
  inputHint?: string;
  outputHint?: string;
}

export interface SearchResponse extends Record<string, unknown> {
  query: string;
  namespace?: string;
  limit: number;
  totalMatches: number;
  results: SearchResult[];
}

export interface ExecuteCommandRequest {
  commandId: string;
  input?: unknown;
}

export interface ExecuteError extends Record<string, unknown> {
  code: "COMMAND_NOT_FOUND" | "INVALID_INPUT" | "EXECUTION_FAILED";
  message: string;
}

export interface ExecuteReportEntry extends Record<string, unknown> {
  commandId: string;
  namespace?: string;
  ok: boolean;
  result?: unknown;
  error?: ExecuteError;
}

export interface ExecuteBatchResponse extends Record<string, unknown> {
  ok: boolean;
  continueOnError: boolean;
  halted: boolean;
  totalRequested: number;
  completed: number;
  report: ExecuteReportEntry[];
}