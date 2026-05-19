import { describe, expect, it } from "vitest";
import { z } from "zod";
import { defineCommand } from "../../src/authoring/defineCommand.js";
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

describe("CommandAtlasRuntime.fromRegistrations", () => {
  it("builds a runtime from in-memory registrations", async () => {
    const runtime = CommandAtlasRuntime.fromRegistrations(config, [
      {
        namespace: "scene",
        command: defineCommand<{ name: string }, { renamedTo: string }>({
          id: "scene.rename_object",
          title: "Rename Scene Object",
          summary: "Rename an object in the scene.",
          description: "Updates the name of an object in the scene state.",
          tags: ["rename", "scene"],
          inputSchema: z.object({
            name: z.string().min(1)
          }),
          run(input) {
            return {
              renamedTo: input.name
            };
          }
        })
      }
    ]);

    const searchResponse = runtime.search("rename object");
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

  it("rejects registrations that target unknown namespaces", () => {
    expect(() =>
      CommandAtlasRuntime.fromRegistrations(config, [
        {
          namespace: "assets",
          command: defineCommand({
            id: "assets.import_asset",
            title: "Import Asset",
            summary: "Import an asset.",
            description: "Registers an asset import.",
            run() {
              return { ok: true };
            }
          })
        }
      ])
    ).toThrowError("Unknown namespace in registration: assets");
  });
});