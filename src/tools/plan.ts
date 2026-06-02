import { callPlanner } from "../planner/callPlanner.js";
import type { CommandAtlasRuntime } from "../runtime/commandAtlasRuntime.js";
import type { PlanResponse, PlanStep } from "../types.js";

export function createPlanHandler(runtime: CommandAtlasRuntime) {
  return async ({ intent }: { intent: string }) => {
    const cfg = runtime.config.planner;
    if (!cfg?.enabled) {
      throw new Error("Planner is not configured. Add a 'planner' section with enabled: true to command-atlas.config.json.");
    }

    const response = await callPlanner(cfg, intent, runtime.commands);

    return {
      content: [
        {
          type: "text" as const,
          text: formatPlanResponse(response)
        }
      ],
      structuredContent: response
    };
  };
}

function formatPlanResponse(response: PlanResponse): string {
  const lines: string[] = [`Plan for: "${response.intent}"`];

  if (response.rationale) {
    lines.push(`Rationale: ${response.rationale}`);
  }

  lines.push("");
  lines.push("Steps:");

  response.steps.forEach((step, i) => {
    if (typeof step === "string") {
      lines.push(`  ${i + 1}. ${step}`);
    } else {
      lines.push(`  ${i + 1}. [parallel]`);
      (step as string[]).forEach((id) => lines.push(`       - ${id}`));
    }
  });

  return lines.join("\n");
}
