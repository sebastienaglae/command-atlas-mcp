import type { CommandAtlasRuntime } from "../runtime/commandAtlasRuntime.js";

export function createExecuteHandler(runtime: CommandAtlasRuntime) {
  return async ({
    commands,
    continueOnError
  }: {
    commands: Array<{ commandId: string; input?: unknown }>;
    continueOnError?: boolean;
  }) => {
    const response = await runtime.execute(commands, continueOnError ?? false);

    return {
      content: [
        {
          type: "text" as const,
          text: formatExecuteResponse(response)
        }
      ],
      structuredContent: response
    };
  };
}

function formatExecuteResponse(response: {
  ok: boolean;
  halted: boolean;
  totalRequested: number;
  completed: number;
  report: Array<{ commandId: string; ok: boolean; error?: { code: string; message: string } }>;
}): string {
  const lines = [
    `Execution ${response.ok ? "succeeded" : "completed with errors"}.`,
    `Processed ${response.completed} of ${response.totalRequested} requested commands.${response.halted ? " Execution halted early." : ""}`
  ];

  for (const entry of response.report) {
    lines.push(
      entry.ok
        ? `- ${entry.commandId}: ok`
        : `- ${entry.commandId}: ${entry.error?.code ?? "ERROR"} - ${entry.error?.message ?? "Unknown error"}`
    );
  }

  return lines.join("\n");
}