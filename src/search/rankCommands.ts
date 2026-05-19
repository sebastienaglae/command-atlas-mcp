import type { LoadedCommand, SearchResponse, SearchResult } from "../types.js";

export interface SearchCommandOptions {
  query: string;
  namespace?: string;
  limit: number;
}

export function searchCommands(commands: LoadedCommand[], options: SearchCommandOptions): SearchResponse {
  const normalizedQuery = options.query.trim().toLowerCase();
  const queryTokens = tokenize(normalizedQuery);

  const filtered = options.namespace
    ? commands.filter((command) => command.namespace === options.namespace)
    : commands;

  const ranked = filtered
    .map((loadedCommand) => ({
      loadedCommand,
      score: scoreCommand(loadedCommand, normalizedQuery, queryTokens)
    }))
    .filter((entry) => entry.score > 0)
    .sort((left, right) => {
      if (right.score !== left.score) {
        return right.score - left.score;
      }

      return left.loadedCommand.command.id.localeCompare(right.loadedCommand.command.id);
    });

  const results = ranked.slice(0, options.limit).map((entry) => toSearchResult(entry.loadedCommand, entry.score));

  return {
    query: options.query,
    namespace: options.namespace,
    limit: options.limit,
    totalMatches: ranked.length,
    results
  };
}

function scoreCommand(loadedCommand: LoadedCommand, normalizedQuery: string, queryTokens: string[]): number {
  const { command, namespace, searchableText } = loadedCommand;
  const aliases = command.aliases ?? [];
  const tags = command.tags ?? [];
  const examples = command.examples ?? [];

  let score = 0;

  if (command.id.toLowerCase() === normalizedQuery) {
    score += 120;
  }

  if (command.id.toLowerCase().includes(normalizedQuery)) {
    score += 45;
  }

  if (command.title.toLowerCase() === normalizedQuery) {
    score += 80;
  }

  if (command.title.toLowerCase().includes(normalizedQuery)) {
    score += 35;
  }

  if (namespace.toLowerCase() === normalizedQuery) {
    score += 25;
  }

  for (const token of queryTokens) {
    if (command.id.toLowerCase().includes(token)) {
      score += 15;
    }

    if (command.title.toLowerCase().includes(token)) {
      score += 12;
    }

    if (namespace.toLowerCase().includes(token)) {
      score += 8;
    }

    if (aliases.some((alias) => alias.toLowerCase().includes(token))) {
      score += 10;
    }

    if (tags.some((tag) => tag.toLowerCase().includes(token))) {
      score += 8;
    }

    if (examples.some((example) => example.toLowerCase().includes(token))) {
      score += 6;
    }

    if (searchableText.includes(token)) {
      score += 3;
    }
  }

  return score;
}

function tokenize(input: string): string[] {
  return input
    .split(/[^a-z0-9_]+/)
    .map((token) => token.trim())
    .filter(Boolean);
}

function toSearchResult(loadedCommand: LoadedCommand, score: number): SearchResult {
  return {
    id: loadedCommand.command.id,
    namespace: loadedCommand.namespace,
    title: loadedCommand.command.title,
    summary: loadedCommand.command.summary,
    description: loadedCommand.command.description,
    score,
    tags: loadedCommand.command.tags ?? [],
    aliases: loadedCommand.command.aliases ?? [],
    examples: loadedCommand.command.examples ?? [],
    inputHint: loadedCommand.command.inputHint,
    outputHint: loadedCommand.command.outputHint
  };
}