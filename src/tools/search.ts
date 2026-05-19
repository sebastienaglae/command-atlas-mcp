import type { CommandAtlasRuntime } from "../runtime/commandAtlasRuntime.js";

export function createSearchHandlers(runtime: CommandAtlasRuntime) {
  return {
    search: async ({ query, limit, namespace }: { query: string; limit?: number; namespace?: string }) => {
      const response = runtime.search(query, limit, namespace);
      return {
        content: [
          {
            type: "text" as const,
            text: formatSearchResponse(response)
          }
        ],
        structuredContent: response
      };
    },
    searchNamespace: async ({ namespace, query, limit }: { namespace: string; query: string; limit?: number }) => {
      const response = runtime.search(query, limit, namespace);
      return {
        content: [
          {
            type: "text" as const,
            text: formatSearchResponse(response)
          }
        ],
        structuredContent: response
      };
    }
  };
}

function formatSearchResponse(response: {
  query: string;
  namespace?: string;
  totalMatches: number;
  results: Array<{ id: string; namespace: string; title: string; summary: string; score: number }>;
}): string {
  const header = response.namespace
    ? `Found ${response.totalMatches} matches in namespace ${response.namespace} for \"${response.query}\".`
    : `Found ${response.totalMatches} matches for \"${response.query}\".`;

  if (response.results.length === 0) {
    return `${header}\nNo matching commands were found.`;
  }

  const lines = response.results.map(
    (result, index) => `${index + 1}. ${result.id} [${result.namespace}] score=${result.score} - ${result.summary}`
  );

  return [header, ...lines].join("\n");
}