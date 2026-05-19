import type {
  AnyLegacyCommandDescriptor,
  CommandRegistration,
  LegacyCommandDescriptor
} from "../types.js";

export interface AdaptCommandRegistryOptions {
  sourcePathPrefix?: string;
}

export function adaptCommandRegistry<TRegistry extends Record<string, AnyLegacyCommandDescriptor>>(
  namespace: string,
  registry: TRegistry,
  options: AdaptCommandRegistryOptions = {}
): CommandRegistration[] {
  return Object.entries(registry).map(([key, descriptor]) => {
    validateRegistryKey(namespace, key);

    return {
      namespace,
      sourcePath: options.sourcePathPrefix ? `${options.sourcePathPrefix}:${key}` : `<registry:${namespace}:${key}>`,
      command: adaptDescriptor(namespace, key, descriptor)
    };
  });
}

function adaptDescriptor(
  namespace: string,
  key: string,
  descriptor: AnyLegacyCommandDescriptor
): CommandRegistration["command"] {
  const commandId = descriptor.id ?? normalizeCommandId(namespace, key);

  return {
    id: commandId,
    title: descriptor.title,
    summary: descriptor.summary,
    description: descriptor.description,
    tags: descriptor.tags,
    aliases: descriptor.aliases,
    examples: descriptor.examples,
    inputHint: descriptor.inputHint,
    outputHint: descriptor.outputHint,
    inputSchema: descriptor.inputSchema,
    run: descriptor.execute
  };
}

function validateRegistryKey(namespace: string, key: string): void {
  if (!namespace.trim()) {
    throw new Error("Namespace is required when adapting a command registry");
  }

  if (!key.trim()) {
    throw new Error("Registry command keys must be non-empty");
  }
}

function normalizeCommandId(namespace: string, key: string): string {
  if (key.includes(".")) {
    return key;
  }

  return `${namespace}.${key.trim().replace(/\s+/g, "_")}`;
}

export type { LegacyCommandDescriptor };