import { z } from "zod";
import type { CommandDefinition } from "../../../../src/types.js";

const inputSchema = z.object({
  source: z.string().min(1),
  destination: z.string().min(1),
  kind: z.enum(["texture", "model", "audio"])
});

interface AssetRecord {
  assetId: string;
  source: string;
  destination: string;
  kind: "texture" | "model" | "audio";
}

interface AssetState {
  assets: AssetRecord[];
}

export const command: CommandDefinition<z.infer<typeof inputSchema>, AssetRecord> = {
  id: "assets.import_asset",
  title: "Import Asset",
  summary: "Register a Blender asset import into the catalog state.",
  description: "Adds a model, texture, or audio asset to the in-memory Blender asset namespace. This simulates a common high-volume authoring command in Blender-oriented MCPs.",
  tags: ["assets", "import", "texture", "model", "audio", "blender"],
  aliases: ["bring asset", "register asset"],
  examples: ["Import a texture into Characters/Hero", "Register a model in Props/Barrel"],
  inputHint: '{ "source": "./hero.png", "destination": "Characters/Hero", "kind": "texture" }',
  outputHint: '{ "assetId": "asset-1", "source": "./hero.png", "destination": "Characters/Hero", "kind": "texture" }',
  inputSchema,
  run(input, context) {
    const assetState = context.getNamespaceState<AssetState>("assets", () => ({ assets: [] }));
    const asset: AssetRecord = {
      assetId: `asset-${assetState.assets.length + 1}`,
      source: input.source,
      destination: input.destination,
      kind: input.kind
    };

    assetState.assets.push(asset);
    return asset;
  }
};

export default command;