# Examples

These examples are optional. They are not loaded by the default starter config.

## Included examples

- Starter default: use `../command-atlas.config.json` for a neutral reusable setup with simple commands.
- Unity example: use `./unity/command-atlas.config.json` for a Unity-oriented catalog with scene commands.
- Blender example: use `./blender/command-atlas.config.json` for a Blender-oriented catalog with asset commands.
- Legacy bridge: see `./legacy-registry-bridge.ts` for adapting an existing command registry programmatically.

## Launch examples

```bash
command-atlas-mcp --config ./examples/unity/command-atlas.config.json
command-atlas-mcp --config ./examples/blender/command-atlas.config.json
```

## Layout

- `./unity` keeps Unity-specific config and commands together.
- `./blender` keeps Blender-specific config and commands together.
- `./legacy-registry-bridge.ts` shows the in-memory migration path.