import { access, readdir } from "node:fs/promises";
import { dirname, resolve, sep, relative } from "node:path";
import { pathToFileURL } from "node:url";
import { normalizeRegistrations } from "./normalizeRegistrations.js";
import type { CommandAtlasConfig, CommandDefinition, CommandAtlasNamespaceConfig, LoadedCommand } from "../types.js";

const SOURCE_COMMAND_SUFFIXES = [".command.ts", ".command.mts", ".command.cts"];
const COMPILED_COMMAND_SUFFIXES = [".command.js", ".command.mjs", ".command.cjs"];
const RUNNING_FROM_DIST = import.meta.url.split("/").includes("dist");

export interface LoadedCatalog {
  config: CommandAtlasConfig;
  commands: LoadedCommand[];
}

export async function loadCatalog(config: CommandAtlasConfig, configPath: string): Promise<LoadedCatalog> {
  const configDirectory = dirname(configPath);
  const projectRoot = await findProjectRoot(configDirectory);
  const registrations: Array<{ namespace: string; command: CommandDefinition; sourcePath: string }> = [];

  for (const namespace of config.namespaces) {
    const namespaceRoot = await resolveNamespaceRoot(projectRoot, configDirectory, namespace.root);
    const commandFiles = await collectCommandFiles(namespaceRoot);

    if (commandFiles.length === 0) {
      throw new Error(`No command files found for namespace ${namespace.id} in ${namespaceRoot}`);
    }

    for (const filePath of commandFiles) {
      const command = await loadCommandFromFile(filePath, namespace);
      registrations.push({
        namespace: namespace.id,
        command,
        sourcePath: filePath
      });
    }
  }

  const commands = normalizeRegistrations(config, registrations);

  return {
    config,
    commands: commands.sort((left, right) => left.command.id.localeCompare(right.command.id))
  };
}

async function resolveNamespaceRoot(projectRoot: string, configDirectory: string, namespaceRoot: string): Promise<string> {
  const sourceRoot = resolve(configDirectory, namespaceRoot);
  const normalizedRoot = namespaceRoot.replace(/^[.][\\/]/, "").replaceAll("\\", "/");
  const relativeConfigDirectory = relative(projectRoot, configDirectory);
  const compiledRoot = resolve(projectRoot, "dist", relativeConfigDirectory, normalizedRoot);

  if (RUNNING_FROM_DIST && (await pathExists(compiledRoot))) {
    return compiledRoot;
  }

  if (await pathExists(sourceRoot)) {
    return sourceRoot;
  }

  if (await pathExists(compiledRoot)) {
    return compiledRoot;
  }

  return sourceRoot;
}

async function findProjectRoot(startDirectory: string): Promise<string> {
  let currentDirectory = startDirectory;

  while (true) {
    if (await pathExists(resolve(currentDirectory, "package.json"))) {
      return currentDirectory;
    }

    const parentDirectory = dirname(currentDirectory);
    if (parentDirectory === currentDirectory) {
      return startDirectory;
    }

    currentDirectory = parentDirectory;
  }
}

async function pathExists(candidatePath: string): Promise<boolean> {
  try {
    await access(candidatePath);
    return true;
  } catch {
    return false;
  }
}

async function collectCommandFiles(root: string): Promise<string[]> {
  const suffixes = RUNNING_FROM_DIST ? COMPILED_COMMAND_SUFFIXES : SOURCE_COMMAND_SUFFIXES;
  const results: string[] = [];
  await walkCommandFiles(root, suffixes, results);
  return results.sort((left, right) => left.localeCompare(right));
}

async function walkCommandFiles(root: string, suffixes: string[], results: string[]): Promise<void> {
  const entries = await readdir(root, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = `${root}${sep}${entry.name}`;
    if (entry.isDirectory()) {
      await walkCommandFiles(fullPath, suffixes, results);
      continue;
    }

    if (suffixes.some((suffix) => entry.name.endsWith(suffix))) {
      results.push(fullPath);
    }
  }
}

async function loadCommandFromFile(
  filePath: string,
  namespace: CommandAtlasNamespaceConfig
): Promise<CommandDefinition> {
  const importedModule = (await import(pathToFileURL(filePath).href)) as {
    command?: CommandDefinition;
    default?: CommandDefinition;
  };
  const exportedCommand = importedModule.command ?? importedModule.default;

  if (!exportedCommand) {
    throw new Error(`Command file ${filePath} must export a command definition`);
  }

  validateCommandDefinition(exportedCommand, filePath);

  if (exportedCommand.namespace && exportedCommand.namespace !== namespace.id) {
    throw new Error(
      `Command ${exportedCommand.id} in ${filePath} declares namespace ${exportedCommand.namespace}, expected ${namespace.id}`
    );
  }

  const normalizedCommand: CommandDefinition = {
    ...exportedCommand,
    namespace: namespace.id,
    tags: exportedCommand.tags ?? [],
    aliases: exportedCommand.aliases ?? [],
    examples: exportedCommand.examples ?? []
  };

  return normalizedCommand;
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