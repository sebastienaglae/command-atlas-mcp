# Command Atlas MCP

- Build against the TypeScript MCP SDK: https://modelcontextprotocol.io and https://modelcontextprotocol.github.io/typescript-sdk/
- Keep stdout reserved for MCP JSON-RPC traffic; operational logs must go to stderr.
- Public tool surface must remain limited to search and execute by default, with optional search_namespace convenience mode.
- Prefer deterministic search ranking and strict input validation for command handlers.