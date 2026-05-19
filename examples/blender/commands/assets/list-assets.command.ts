import { z } from "zod";
import type { CommandDefinition } from "../../../../src/types.js";

const inputSchema = z
  .object({
    kind: z.enum(["texture", "model", "audio"]).optional()
  })
  .optional();

interface AssetRecord {
  assetId: string;
  source: string;
  destination: string;
  kind: "texture" | "model" | "audio";
}

interface AssetState {
  assets: AssetRecord[];
}

export const command: CommandDefinition<z.infer<typeof inputSchema>, { count: number; items: AssetRecord[] }> = {
  id: "assets.list_assets",
  title: "List Assets",
  summary: "List assets tracked in the Blender asset namespace.",
  description: "Returns the imported asset records from the in-memory Blender asset state, optionally filtered by asset kind.",
  tags: ["assets", "list", "inspect", "catalog", "blender"],
  aliases: ["show assets", "inspect asset catalog"],
  examples: ["List imported assets", "List model assets"],
  inputHint: '{ "kind": "model" }',
  outputHint: '{ "count": 1, "items": [{ "assetId": "asset-1", "source": "./barrel.glb", "destination": "Props/Barrel", "kind": "model" }] }',
  inputSchema,
  run(input, context) {
    const assetState = context.getNamespaceState<AssetState>("assets", () => ({ assets: [] }));
    const items = input?.kind ? assetState.assets.filter((asset) => asset.kind === input.kind) : assetState.assets;

    return {
      count: items.length,
      items
    };
  }
};

export default command;