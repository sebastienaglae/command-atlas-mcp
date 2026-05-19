import { z } from "zod";
import type { CommandDefinition } from "../../../../src/types.js";

const inputSchema = z.object({
  name: z.string().min(1),
  template: z.enum(["cube", "sphere", "light"])
});

interface SceneObject {
  objectId: string;
  name: string;
  template: "cube" | "sphere" | "light";
}

interface SceneState {
  objects: SceneObject[];
}

export const command: CommandDefinition<z.infer<typeof inputSchema>, SceneObject> = {
  id: "scene.create_object",
  title: "Create Scene Object",
  summary: "Create a Unity scene object from a common template.",
  description: "Adds a new object to the in-memory Unity scene state. Useful for authoring or automation flows that need to create cubes, spheres, or lights before additional steps.",
  tags: ["scene", "create", "object", "unity"],
  aliases: ["spawn object", "add object"],
  examples: ["Create a sphere named PlayerSpawn", "Add a light named KeyLight"],
  inputHint: '{ "name": "PlayerSpawn", "template": "sphere" }',
  outputHint: '{ "objectId": "scene-1", "name": "PlayerSpawn", "template": "sphere" }',
  inputSchema,
  run(input, context) {
    const sceneState = context.getNamespaceState<SceneState>("scene", () => ({ objects: [] }));
    const object: SceneObject = {
      objectId: `scene-${sceneState.objects.length + 1}`,
      name: input.name,
      template: input.template
    };

    sceneState.objects.push(object);
    return object;
  }
};

export default command;