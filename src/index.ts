export { createServer, startServer } from "./server.js";
export { CommandAtlasRuntime } from "./runtime/commandAtlasRuntime.js";
export { defineCommand } from "./authoring/defineCommand.js";
export { adaptCommandRegistry } from "./adapters/adaptCommandRegistry.js";
export { getCliHelpText, parseCliArgs } from "./cli/parseCliArgs.js";
export { COMMAND_ATLAS_SERVER_NAME, COMMAND_ATLAS_SERVER_VERSION } from "./metadata.js";
export type {
	CommandAtlasConfig,
	CommandDefinition,
	LegacyCommandDescriptor,
	CommandRegistration,
	ExecuteBatchResponse,
	ExecuteCommandRequest,
	SearchResponse
} from "./types.js";