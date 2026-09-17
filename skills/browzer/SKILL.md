---
name: browzer
description: >
  Record a replayable agent-browser session by invoking the same CLI as
  agent-browser through the browzer wrapper. Use instead of agent-browser when
  the user wants a trace, recording, HAR, console dump, replay, inspect, or
  post-mortem of a browser run. Triggers: browzer, replay the session, record
  this browser run, debug the agent browser session, trace, inspect the
  recording. Use when the user runs /browzer.
allowed-tools: Bash(browzer:*), Bash(./bin/browzer:*)
---

# Browzer

`browzer` is `agent-browser` with a trace. Same argv, same snapshot/click loop.

The command is `browzer` on PATH. In the browzer git checkout, use `./bin/browzer` if PATH is not set. Refresh this skill from the installed CLI with `browzer skills get` so instructions match the binary.

Do not run `agent-browser` in the same `--session`. Live watching is `agent-browser dashboard`, not Browzer. For how to snapshot, click, fill, and wait, follow the agent-browser core skill; every process you spawn is `browzer`.

## Session

Before the first command:

```bash
export AGENT_BROWSER_SESSION="$(browzer session id --scope worktree --prefix task)"
export AGENT_BROWSER_IDLE_TIMEOUT_MS=0
```

Then pass `--session "$AGENT_BROWSER_SESSION"` on every `browzer` command, or rely on the env var. Pass `--output <dir>` (or `BROWZER_OUTPUT`) to choose where the trace folder is written; default is the current working directory.

## Drive the browser

```bash
browzer --session "$AGENT_BROWSER_SESSION" open https://example.com
browzer --session "$AGENT_BROWSER_SESSION" snapshot -i
browzer --session "$AGENT_BROWSER_SESSION" click @e1
browzer --session "$AGENT_BROWSER_SESSION" close
```

`close` finalizes the trace (video, HAR, console, errors, snapshot, `summary.md`). If inspect is empty, the session was never closed.

`dashboard`, `mcp`, `doctor`, `install`, and `upgrade` pass through and do not create a trace.

## After the run

- Agent: `browzer inspect [id]` (latest if omitted). Read `summary.md` first, then HAR/console/errors in the trace directory (`./<id>/` or `--output`).
- Human: `browzer replay [id|path]`.
- List: `browzer traces`.
