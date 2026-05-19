import { z } from "zod";
import type { CommandDefinition } from "../../../src/types.js";

const inputSchema = z.object({
  label: z.string().min(1)
});

interface DemoItem {
  itemId: string;
  label: string;
}

interface DemoState {
  items: DemoItem[];
}

export const command: CommandDefinition<z.infer<typeof inputSchema>, DemoItem> = {
  id: "demo.add_item",
  title: "Add Item",
  summary: "Add a simple item to the demo state.",
  description: "Stores a small labeled item in in-memory demo state. This is the default starter example for search and execute flows.",
  tags: ["demo", "add", "item", "starter"],
  aliases: ["create item", "append item"],
  examples: ["Add an item labeled First task"],
  inputHint: '{ "label": "First task" }',
  outputHint: '{ "itemId": "demo-1", "label": "First task" }',
  inputSchema,
  run(input, context) {
    const state = context.getNamespaceState<DemoState>("demo", () => ({ items: [] }));
    const item: DemoItem = {
      itemId: `demo-${state.items.length + 1}`,
      label: input.label
    };

    state.items.push(item);
    return item;
  }
};

export default command;