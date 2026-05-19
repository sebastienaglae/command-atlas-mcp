import { describe, expect, it } from "vitest";
import { z } from "zod";
import { adaptCommandRegistry } from "../../src/adapters/adaptCommandRegistry.js";
import { CommandAtlasRuntime } from "../../src/runtime/commandAtlasRuntime.js";
import type { CommandAtlasConfig } from "../../src/types.js";

const config: CommandAtlasConfig = {
  version: 1,
  catalog: {
    defaultLimit: 5,
    maxResults: 10
  },
  namespaces: [
    {
      id: "scene",
      title: "Scene Commands",
      root: "./scene"
    }
  ]
};

describe("adaptCommandRegistry", () => {
  it("converts a legacy registry into searchable and executable registrations", async () => {
    const registrations = adaptCommandRegistry(
      "scene",
      {
        rename_object: {
          title: "Rename Scene Object",
          summary: "Rename an object in the scene.",
          description: "Bridges an existing scene registry into Command Atlas without rewriting the original handler.",
          tags: ["rename", "scene"],
          inputSchema: z.object({
            name: z.string().min(1)
          }),
          execute(input: { name: string }) {
            return {
              renamedTo: input.name
            };
          }
        }
      },
      {
        sourcePathPrefix: "legacy-scene-registry"
      }
    );

    expect(registrations[0]?.command.id).toBe("scene.rename_object");
    expect(registrations[0]?.sourcePath).toBe("legacy-scene-registry:rename_object");

    const runtime = CommandAtlasRuntime.fromRegistrations(config, registrations);
    const searchResponse = runtime.search("rename scene object");
    expect(searchResponse.results[0]?.id).toBe("scene.rename_object");

    const executeResponse = await runtime.execute([
      {
        commandId: "scene.rename_object",
        input: {
          name: "GameplayCamera"
        }
      }
    ]);

    expect(executeResponse.ok).toBe(true);
    expect(executeResponse.report[0]?.result).toMatchObject({
      renamedTo: "GameplayCamera"
    });
  });

  it("keeps explicit command ids from the legacy registry", () => {
    const registrations = adaptCommandRegistry("scene", {
      renameObject: {
        id: "custom.rename_object",
        title: "Rename Scene Object",
        summary: "Rename an object.",
        description: "Uses an explicit id already present in the legacy registry.",
        execute() {
          return { ok: true };
        }
      }
    });

    expect(registrations[0]?.command.id).toBe("custom.rename_object");
  });

  it("rejects empty registry keys", () => {
    expect(() =>
      adaptCommandRegistry("scene", {
        "": {
          title: "Invalid",
          summary: "Invalid",
          description: "Invalid",
          execute() {
            return { ok: false };
          }
        }
      })
    ).toThrowError("Registry command keys must be non-empty");
  });
});