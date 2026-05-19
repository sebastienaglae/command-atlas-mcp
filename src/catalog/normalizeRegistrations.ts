import type {
  CommandAtlasConfig,
  CommandAtlasNamespaceConfig,
  CommandDefinition,
  CommandRegistration,
  LoadedCommand
} from "../types.js";

export function normalizeRegistrations(
  config: CommandAtlasConfig,
  registrations: CommandRegistration[]
): LoadedCommand[] {
  const namespaces = new Map(config.namespaces.map((namespace) => [namespace.id, namespace]));
  const seenCommandIds = new Set<string>();

  return registrations.map((registration, index) => {
    const namespace = namespaces.get(registration.namespace);
    if (!namespace) {
      throw new Error(`Unknown namespace in registration: ${registration.namespace}`);
    }

    validateCommandDefinition(registration.command, registration.sourcePath ?? `<registration:${index}>`);

    if (registration.command.namespace && registration.command.namespace !== registration.namespace) {
      throw new Error(
        `Command ${registration.command.id} declares namespace ${registration.command.namespace}, expected ${registration.namespace}`
      );
    }

    if (seenCommandIds.has(registration.command.id)) {
      throw new Error(`Duplicate command id: ${registration.command.id}`);
    }

    seenCommandIds.add(registration.command.id);

    const normalizedCommand: CommandDefinition = {
      ...registration.command,
      namespace: registration.namespace,
      tags: registration.command.tags ?? [],
      aliases: registration.command.aliases ?? [],
      examples: registration.command.examples ?? []
    };

    return {
      command: normalizedCommand,
      namespace: namespace.id,
      namespaceTitle: namespace.title,
      sourcePath: registration.sourcePath ?? `<registration:${registration.command.id}>`,
      searchableText: buildSearchableText(normalizedCommand, namespace)
    };
  });
}

function validateCommandDefinition(command: CommandDefinition, filePath: string): void {
  if (!command.id.trim()) {
    throw new Error(`Command id is required in ${filePath}`);
  }

  if (!command.title.trim()) {
    throw new Error(`Command title is required in ${filePath}`);
  }

  if (!command.summary.trim()) {
    throw new Error(`Command summary is required in ${filePath}`);
  }

  if (!command.description.trim()) {
    throw new Error(`Command description is required in ${filePath}`);
  }

  if (typeof command.run !== "function") {
    throw new Error(`Command run handler is required in ${filePath}`);
  }
}

function buildSearchableText(command: CommandDefinition, namespace: CommandAtlasNamespaceConfig): string {
  return [
    command.id,
    namespace.id,
    namespace.title,
    command.title,
    command.summary,
    command.description,
    ...(command.tags ?? []),
    ...(command.aliases ?? []),
    ...(command.examples ?? [])
  ]
    .join(" ")
    .toLowerCase();
}