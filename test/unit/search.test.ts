import { resolve } from "node:path";
import { beforeEach, describe, expect, it } from "vitest";
import { CommandAtlasRuntime } from "../../src/runtime/commandAtlasRuntime.js";

const repoRoot = resolve(__dirname, "..", "..");
const configPath = resolve(repoRoot, "command-atlas.config.json");

describe("CommandAtlasRuntime.search", () => {
  let runtime: CommandAtlasRuntime;

  beforeEach(async () => {
    runtime = await CommandAtlasRuntime.create(configPath);
  });

  it("returns the most relevant command for a wide search", () => {
    const response = runtime.search("add item", 3);

    expect(response.totalMatches).toBeGreaterThan(0);
    expect(response.results[0]?.id).toBe("demo.add_item");
  });

  it("filters results by namespace", () => {
    const response = runtime.search("item", 10, "demo");

    expect(response.results.length).toBeGreaterThan(0);
    expect(response.results.every((result) => result.namespace === "demo")).toBe(true);
  });

  it("rejects unknown namespaces", () => {
    expect(() => runtime.search("anything", 5, "unknown")).toThrowError("Unknown namespace: unknown");
  });
});