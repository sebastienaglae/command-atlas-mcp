import { z } from "zod";
import {
  adaptCommandRegistry,
  CommandAtlasRuntime,
  createServer,
  type CommandAtlasConfig,
  type LegacyCommandDescriptor
} from "../src/index.js";

const config: CommandAtlasConfig = {
  version: 1,
  catalog: {
    defaultLimit: 5,
    maxResults: 20
  },
  namespaces: [
    {
      id: "scene",
      title: "Scene Commands",
      root: "./scene"
    }
  ]
};

const legacySceneRegistry: Record<
  string,
  LegacyCommandDescriptor<{ name: string }, { renamedTo: string; source: string }>
> = {
  rename_object: {
    title: "Rename Scene Object",
    summary: "Rename an object in the scene.",
    description: "Adapts a pre-existing scene command handler into the Command Atlas catalog.",
    tags: ["scene", "rename", "legacy"],
    inputSchema: z.object({
      name: z.string().min(1)
    }),
    async execute(input: { name: string }) {
      return {
        renamedTo: input.name,
        source: "legacy-scene-registry"
      };
    }
  }
};

async function main(): Promise<void> {
  const registrations = adaptCommandRegistry("scene", legacySceneRegistry, {
    sourcePathPrefix: "legacy-scene-registry"
  });

  const runtime = CommandAtlasRuntime.fromRegistrations(config, registrations);
  const server = await createServer({ runtime });

  console.error(`Loaded ${runtime.commands.length} adapted commands into Command Atlas MCP.`);
  await server.close();
}

main().catch((error: unknown) => {
  console.error("Failed to build legacy registry bridge example", error);
  process.exitCode = 1;
});