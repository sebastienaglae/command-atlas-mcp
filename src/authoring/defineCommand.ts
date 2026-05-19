import type { CommandDefinition } from "../types.js";

export function defineCommand<TInput = unknown, TOutput = unknown>(
  command: CommandDefinition<TInput, TOutput>
): CommandDefinition<TInput, TOutput> {
  return command;
}