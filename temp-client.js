import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { spawn } from "child_process";

async function main() {
  const transport = new StdioClientTransport({
    command: "node",
    args: ["dist/src/server.js"]
  });

  const client = new Client({
    name: "test-client",
    version: "1.0.0"
  }, {
    capabilities: {}
  });

  await client.connect(transport);

  console.log("--- LIST TOOLS ---");
  const tools = await client.listTools();
  console.log(JSON.stringify(tools, null, 2));

  console.log("--- SEARCH RESULT ---");
  const result = await client.callTool({
    name: "search",
    arguments: { query: "add item" }
  });
  console.log(JSON.stringify(result, null, 2));

  process.exit(0);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
