import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { z } from "zod";
import type { CommandAtlasConfig } from "../types.js";

export const DEFAULT_CONFIG_FILE = "command-atlas.config.json";

const namespaceSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  description: z.string().min(1).optional(),
  root: z.string().min(1)
});

const configSchema = z.object({
  version: z.literal(1),
  catalog: z
    .object({
      defaultLimit: z.number().int().min(1).max(100).default(8),
      maxResults: z.number().int().min(1).max(100).default(20)
    })
    .default({
      defaultLimit: 8,
      maxResults: 20
    }),
  surface: z
    .object({
      exposeSearchNamespaceTool: z.boolean().default(false)
    })
    .default({
      exposeSearchNamespaceTool: false
    }),
  namespaces: z.array(namespaceSchema).min(1)
});

export function resolveConfigPath(configPath?: string): string {
  if (configPath) {
    return resolve(configPath);
  }

  if (process.env.COMMAND_ATLAS_CONFIG_PATH) {
    return resolve(process.env.COMMAND_ATLAS_CONFIG_PATH);
  }

  return resolve(process.cwd(), DEFAULT_CONFIG_FILE);
}

export async function loadConfig(configPath?: string): Promise<{ configPath: string; config: CommandAtlasConfig }> {
  const resolvedConfigPath = resolveConfigPath(configPath);
  const fileContents = await readFile(resolvedConfigPath, "utf8");
  const rawConfig = JSON.parse(fileContents) as unknown;
  const config = configSchema.parse(rawConfig);

  const namespaceIds = new Set<string>();
  for (const namespace of config.namespaces) {
    if (namespaceIds.has(namespace.id)) {
      throw new Error(`Duplicate namespace id: ${namespace.id}`);
    }
    namespaceIds.add(namespace.id);
  }

  if (config.catalog.defaultLimit > config.catalog.maxResults) {
    throw new Error("catalog.defaultLimit must be less than or equal to catalog.maxResults");
  }

  return {
    configPath: resolvedConfigPath,
    config
  };
}