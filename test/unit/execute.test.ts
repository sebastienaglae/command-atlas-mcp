import { resolve } from "node:path";
import { beforeEach, describe, expect, it } from "vitest";
import { CommandAtlasRuntime } from "../../src/runtime/commandAtlasRuntime.js";

const repoRoot = resolve(__dirname, "..", "..");
const configPath = resolve(repoRoot, "command-atlas.config.json");

describe("CommandAtlasRuntime.execute", () => {
  let runtime: CommandAtlasRuntime;

  beforeEach(async () => {
    runtime = await CommandAtlasRuntime.create(configPath);
  });

  it("executes a sequential batch and shares namespace state", async () => {
    const response = await runtime.execute([
      {
        commandId: "demo.add_item",
        input: {
          label: "First task"
        }
      },
      {
        commandId: "demo.list_items",
        input: {
          contains: "task"
        }
      }
    ]);

    expect(response.ok).toBe(true);
    expect(response.report).toHaveLength(2);
    expect(response.report[0]?.ok).toBe(true);
    expect(response.report[1]?.ok).toBe(true);
    expect(response.report[1]?.result).toMatchObject({
      count: 1,
      items: [
        {
          label: "First task"
        }
      ]
    });
  });

  it("halts on the first validation error by default", async () => {
    const response = await runtime.execute([
      {
        commandId: "demo.add_item",
        input: {
          wrong: "value"
        }
      },
      {
        commandId: "demo.list_items"
      }
    ]);

    expect(response.ok).toBe(false);
    expect(response.halted).toBe(true);
    expect(response.completed).toBe(1);
    expect(response.report[0]?.error).toMatchObject({
      code: "INVALID_INPUT"
    });
  });

  it("continues when continueOnError is enabled", async () => {
    const response = await runtime.execute(
      [
        {
          commandId: "missing.command"
        },
        {
          commandId: "demo.list_items"
        }
      ],
      true
    );

    expect(response.ok).toBe(false);
    expect(response.halted).toBe(false);
    expect(response.completed).toBe(2);
    expect(response.report[0]?.error).toMatchObject({ code: "COMMAND_NOT_FOUND" });
    expect(response.report[1]?.ok).toBe(true);
  });
});