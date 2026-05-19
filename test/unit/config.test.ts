import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { loadConfig, resolveConfigPath } from "../../src/config/loadConfig.js";

const repoRoot = resolve(__dirname, "..", "..");
const configPath = resolve(repoRoot, "command-atlas.config.json");

describe("loadConfig", () => {
  it("loads the default public config", async () => {
    const loadedConfig = await loadConfig(configPath);

    expect(loadedConfig.config.version).toBe(1);
    expect(loadedConfig.config.catalog.defaultLimit).toBe(6);
    expect(loadedConfig.config.surface?.exposeSearchNamespaceTool).toBe(false);
    expect(loadedConfig.config.namespaces.map((namespace) => namespace.id)).toEqual(["demo"]);
  });

  it("resolves explicit config paths without environment dependency", () => {
    expect(resolveConfigPath(configPath)).toBe(configPath);
  });
});