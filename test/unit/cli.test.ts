import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { getCliHelpText, parseCliArgs } from "../../src/cli/parseCliArgs.js";
import { COMMAND_ATLAS_SERVER_VERSION } from "../../src/metadata.js";

const repoRoot = resolve(__dirname, "..", "..");

describe("parseCliArgs", () => {
  it("parses a config path and namespace exposure flag", () => {
    const parsed = parseCliArgs(["--config", "./custom.config.json", "--expose-search-namespace"]);

    expect(parsed).toEqual({
      configPath: "./custom.config.json",
      exposeNamespaceTool: true
    });
  });

  it("can force a two-tool surface from the CLI", () => {
    const parsed = parseCliArgs(["--hide-search-namespace"]);

    expect(parsed).toEqual({
      exposeNamespaceTool: false
    });
  });

  it("rejects missing config values", () => {
    expect(() => parseCliArgs(["--config"])).toThrowError("Missing value for --config");
  });

  it("returns stable help text", () => {
    expect(getCliHelpText()).toContain("--expose-search-namespace");
    expect(getCliHelpText()).toContain("--hide-search-namespace");
    expect(getCliHelpText()).toContain("--version");
  });

  it("parses --help without treating it as an error", () => {
    const parsed = parseCliArgs(["--help"]);

    expect(parsed).toEqual({
      showHelp: true
    });
  });

  it("parses --version without treating it as an error", () => {
    const parsed = parseCliArgs(["--version"]);

    expect(parsed).toEqual({
      showVersion: true
    });
    expect(COMMAND_ATLAS_SERVER_VERSION).toBe("0.1.0");
  });

  it("keeps the runtime version aligned with package.json", () => {
    const packageJson = JSON.parse(readFileSync(resolve(repoRoot, "package.json"), "utf8")) as { version: string };

    expect(COMMAND_ATLAS_SERVER_VERSION).toBe(packageJson.version);
  });
});