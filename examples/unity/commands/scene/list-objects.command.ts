import { z } from "zod";
import type { CommandDefinition } from "../../../../src/types.js";

const inputSchema = z
  .object({
    template: z.enum(["cube", "sphere", "light"]).optional()
  })
  .optional();

interface SceneObject {
  objectId: string;
  name: string;
  template: "cube" | "sphere" | "light";
}

interface SceneState {
  objects: SceneObject[];
}

export const command: CommandDefinition<z.infer<typeof inputSchema>, { count: number; items: SceneObject[] }> = {
  id: "scene.list_objects",
  title: "List Scene Objects",
  summary: "List objects currently tracked in the Unity scene state.",
  description: "Reads the in-memory Unity scene state and returns every known object, optionally filtered by template. Useful after create, import, or cleanup flows.",
  tags: ["scene", "list", "inspect", "object", "unity"],
  aliases: ["show objects", "inspect scene"],
  examples: ["List all scene objects", "List sphere objects"],
  inputHint: '{ "template": "sphere" }',
  outputHint: '{ "count": 2, "items": [{ "objectId": "scene-1", "name": "PlayerSpawn", "template": "sphere" }] }',
  inputSchema,
  run(input, context) {
    const sceneState = context.getNamespaceState<SceneState>("scene", () => ({ objects: [] }));
    const items = input?.template
      ? sceneState.objects.filter((object) => object.template === input.template)
      : sceneState.objects;

    return {
      count: items.length,
      items
    };
  }
};

export default command;