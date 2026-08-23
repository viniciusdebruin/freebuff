# Freebuff Agent Toolkit

This is an isolated, dependency-free contribution for Freebuff. It turns four
useful agent behaviors into small, testable modules integrated into the Freebuff
CLI without coupling the core runtime to provider-specific code:

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

The CLI exposes the modules through `/toolkit`, `/repo-map`, `/profiles`, and
`/background`. The integration keeps the modules independently testable while
making the features available in the normal Freebuff session.

Examples:

```text
/repo-map --tokens 3000 src cli
/profiles add coding https://your-endpoint/v1 your-model FREEBUFF_CODING_KEY 80
/profiles route implementation coding
/background start bun run dev
```

Background commands are started directly with `spawn`, never through a shell.

## State layout

By default, state is stored below `${XDG_STATE_HOME:-~/.local/state}/freebuff/agent-toolkit`
and profile configuration below `${XDG_CONFIG_HOME:-~/.config}/freebuff/agent-toolkit`.
Set `FREEBUFF_AGENT_TOOLKIT_HOME` in tests or a managed installation to use a
different root. JSON writes are atomic and private files are created with mode
`0600`.
