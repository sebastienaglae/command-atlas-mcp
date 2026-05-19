import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { loadConfig } from "../../src/config/loadConfig.js";
import { CommandAtlasRuntime } from "../../src/runtime/commandAtlasRuntime.js";

const repoRoot = resolve(__dirname, "..", "..");
const unityConfigPath = resolve(repoRoot, "examples", "unity", "command-atlas.config.json");
const blenderConfigPath = resolve(repoRoot, "examples", "blender", "command-atlas.config.json");

describe("example configs", () => {
  it("loads the Unity example config and catalog", async () => {
    const loadedConfig = await loadConfig(unityConfigPath);
    expect(loadedConfig.config.namespaces.map((namespace) => namespace.id)).toEqual(["scene"]);

    const runtime = await CommandAtlasRuntime.create(unityConfigPath);
    const response = runtime.search("create sphere object", 3);

    expect(response.results[0]?.id).toBe("scene.create_object");
  });

  it("loads the Blender example config and catalog", async () => {
    const loadedConfig = await loadConfig(blenderConfigPath);
    expect(loadedConfig.config.namespaces.map((namespace) => namespace.id)).toEqual(["assets"]);

    const runtime = await CommandAtlasRuntime.create(blenderConfigPath);
    const response = runtime.search("import texture asset", 3);

    expect(response.results[0]?.id).toBe("assets.import_asset");
  });
});