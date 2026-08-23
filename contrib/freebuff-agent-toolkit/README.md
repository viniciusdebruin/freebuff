# Freebuff Agent Toolkit

This is an isolated, dependency-free contribution for Freebuff. It turns four
useful agent behaviors into small, testable modules that can be integrated into
the CLI without coupling them to the current command router:

- named provider profiles that keep credentials in environment variables;
- durable background sessions with private metadata and bounded logs;
- a lightweight, token-budgeted repository map based on source definitions and
  import relationships;
- deterministic task routing with explicit step limits and fallbacks.

The implementation is original and uses only the platform runtime. It does not
persist API keys, invoke a shell for background commands, or copy provider
specific integrations into the Freebuff core.

## Run locally

From this directory:

```sh
bun test
bun run typecheck
```

The modules are intentionally independent. The planned CLI integration points
are the existing provider/session command surfaces, so this folder can be
reviewed or cherry-picked as one unit before wiring new commands into the main
interactive loop.

## State layout

By default, state is stored below `${XDG_STATE_HOME:-~/.local/state}/freebuff/agent-toolkit`
and profile configuration below `${XDG_CONFIG_HOME:-~/.config}/freebuff/agent-toolkit`.
Set `FREEBUFF_AGENT_TOOLKIT_HOME` in tests or a managed installation to use a
different root. JSON writes are atomic and private files are created with mode
`0600`.
