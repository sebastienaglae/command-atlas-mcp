import { z } from "zod";
import type { CommandDefinition } from "../../../src/types.js";

const inputSchema = z
  .object({
    contains: z.string().min(1).optional()
  })
  .optional();

interface DemoItem {
  itemId: string;
  label: string;
}

interface DemoState {
  items: DemoItem[];
}

export const command: CommandDefinition<z.infer<typeof inputSchema>, { count: number; items: DemoItem[] }> = {
  id: "demo.list_items",
  title: "List Items",
  summary: "List the items currently stored in the demo state.",
  description: "Reads the in-memory starter state and returns each item, optionally filtered by a text fragment.",
  tags: ["demo", "list", "item", "starter"],
  aliases: ["show items", "inspect items"],
  examples: ["List all items", "List items containing task"],
  inputHint: '{ "contains": "task" }',
  outputHint: '{ "count": 1, "items": [{ "itemId": "demo-1", "label": "First task" }] }',
  inputSchema,
  run(input, context) {
    const state = context.getNamespaceState<DemoState>("demo", () => ({ items: [] }));
    const contains = input?.contains;
    const items = contains
      ? state.items.filter((item) => item.label.toLowerCase().includes(contains.toLowerCase()))
      : state.items;

    return {
      count: items.length,
      items
    };
  }
};

export default command;